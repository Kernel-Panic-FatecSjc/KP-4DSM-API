import { randomUUID } from 'node:crypto';
import {
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';
import { EstacaoParametrosRespostaDto } from './dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './dto/ingestao-resposta.dto';
import { IngerirTelemetriaDto } from './dto/ingerir-telemetria.dto';
import { LeituraBrutaParaGravar, MedidaParaGravar, TelemetriaService } from './telemetria.service';

// Parte de um lote que falhou ao gravar e volta para a próxima tentativa.
interface LoteComFalha<T> {
  itens: T[];
  tentativas: number;
}

// Pausa entre as tentativas feitas no encerramento, quando não há mais o
// timer do flush para esperar o banco voltar.
const PAUSA_ENTRE_TENTATIVAS_NO_ENCERRAMENTO_MS = 250;
// Itens por linha no log de descarte, para não montar uma linha de vários MB.
const ITENS_POR_LINHA_DE_LOG = 500;

const esperar = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms).unref?.());

@Injectable()
export class IngestaoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(IngestaoService.name);

  // Buffers em memória: em vez de gravar uma leitura bruta e uma medida por
  // requisição, acumula os dois e grava em lotes grandes (ver flush()), para
  // o trigger de alertas — que roda uma vez por statement — processar muitas
  // leituras de uma vez.
  private loteBrutas: LeituraBrutaParaGravar[] = [];
  private loteMedidas: MedidaParaGravar[] = [];
  // Lotes que falharam ao gravar: entram de novo no próximo flush até
  // esgotar as tentativas, para não perder leitura já respondida com 202.
  private falhasBrutas: LoteComFalha<LeituraBrutaParaGravar>[] = [];
  private falhasMedidas: LoteComFalha<MedidaParaGravar>[] = [];
  // Encadeia os flushes (timer, lote cheio, encerramento) para que dois não
  // peguem as mesmas falhas ao mesmo tempo. Fica no máximo um esperando: com
  // o banco lento, o lote cheio pediria um flush por requisição, e cada um
  // gastaria uma tentativa das falhas em sequência.
  private flushEmAndamento: Promise<void> = Promise.resolve();
  private flushNaFila?: Promise<void>;
  // O que está sendo gravado agora, para o log caso o encerramento estoure o prazo.
  private emGravacao?: { brutas: LeituraBrutaParaGravar[]; medidas: MedidaParaGravar[] };
  private encerrando = false;
  private timer?: NodeJS.Timeout;
  private readonly tamanhoLoteMaximo: number;
  private readonly intervaloFlushMs: number;
  private readonly tentativasMaximas: number;
  private readonly prazoEncerramentoMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetria: TelemetriaService,
    config: ConfigService,
  ) {
    this.tamanhoLoteMaximo = Number(config.get('INGESTAO_LOTE_TAMANHO_MAX') ?? 5000);
    this.intervaloFlushMs = Number(config.get('INGESTAO_LOTE_INTERVALO_MS') ?? 2000);
    this.tentativasMaximas = Number(config.get('INGESTAO_LOTE_TENTATIVAS_MAX') ?? 5);
    this.prazoEncerramentoMs = Number(config.get('INGESTAO_ENCERRAMENTO_PRAZO_MS') ?? 8000);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), this.intervaloFlushMs);
    this.timer.unref?.();
  }

  // Roda no encerramento (SIGTERM, com enableShutdownHooks em configurarApp):
  // para de aceitar leituras, grava o buffer e insiste nas falhas até esgotar
  // as tentativas ou o prazo. O prazo fica abaixo dos 10 s do docker stop,
  // para o descarte sair no log antes de um SIGKILL.
  async onModuleDestroy(): Promise<void> {
    this.encerrando = true;
    clearInterval(this.timer);

    const prazo = Date.now() + this.prazoEncerramentoMs;
    const terminou = await Promise.race([
      this.drenar(prazo).then(() => true),
      esperar(this.prazoEncerramentoMs).then(() => false),
    ]);
    if (!terminou || this.temFalhasPendentes()) this.descartarNoEncerramento();
  }

  private async drenar(prazo: number): Promise<void> {
    await this.flush();
    while (this.temFalhasPendentes() && Date.now() + PAUSA_ENTRE_TENTATIVAS_NO_ENCERRAMENTO_MS < prazo) {
      await esperar(PAUSA_ENTRE_TENTATIVAS_NO_ENCERRAMENTO_MS);
      await this.flush();
    }
  }

  private descartarNoEncerramento(): void {
    const brutas = this.emGravacao?.brutas ?? this.falhasBrutas.flatMap((lote) => lote.itens);
    const medidas = this.emGravacao?.medidas ?? this.falhasMedidas.flatMap((lote) => lote.itens);
    const motivo = this.emGravacao
      ? `encerramento sem concluir a gravação em ${this.prazoEncerramentoMs} ms (podem ter sido gravados)`
      : 'encerramento com falhas ainda pendentes';
    this.registrarDescarte('leitura(s) bruta(s)', [...brutas, ...this.loteBrutas], motivo);
    this.registrarDescarte('medida(s)', [...medidas, ...this.loteMedidas], motivo);
  }

  async ingerir(payload: IngerirTelemetriaDto): Promise<IngestaoRespostaDto> {
    // 'join': uma consulta só. O padrão do Prisma busca a estação, os parâmetros
    // e os tipos em consultas separadas, e numa rota de milhares de req/s isso
    // era o grosso do CPU da API (ver docs/teste-de-carga-ingestao.md).
    const estacao = await this.prisma.estacao.findUnique({
      where: { vid: payload.vid },
      relationLoadStrategy: 'join',
      select: {
        id: true,
        latitude: true,
        longitude: true,
        parametros: { select: { id: true, tipoParametro: { select: { nome: true } } } },
      },
    });

    if (!estacao) {
      throw new NotFoundException(`Nenhuma estação cadastrada para o vid "${payload.vid}"`);
    }

    // Conferido depois da consulta, logo antes de entrar no buffer: o que
    // entra a partir daqui não teria mais flush. 503 faz o datalogger reenviar.
    if (this.encerrando) {
      throw new ServiceUnavailableException('API em encerramento; reenvie a leitura');
    }

    const agora = Math.floor(Date.now() / 1000);
    const unixtimeDispositivo = payload.unixtime ?? agora;
    // Gerado aqui, não pelo banco: a gravação em si só acontece no próximo
    // flush do lote, mas o dispositivo já recebe o id na resposta (202 =
    // aceito para processamento, não "já commitado" — a semântica bate).
    const leituraBrutaId = randomUUID();

    this.loteBrutas.push({
      id: leituraBrutaId,
      vidEstacao: payload.vid,
      payload: payload.leituras,
      latitude: payload.latitude ?? estacao.latitude,
      longitude: payload.longitude ?? estacao.longitude,
      unixtimeDispositivo,
    });

    this.enfileirarMedidas(estacao, payload.leituras, unixtimeDispositivo);

    if (this.loteBrutas.length >= this.tamanhoLoteMaximo || this.loteMedidas.length >= this.tamanhoLoteMaximo) {
      void this.flush();
    }

    return new IngestaoRespostaDto(
      leituraBrutaId,
      estacao.id,
      Object.keys(payload.leituras).length,
      agora,
    );
  }

  private enfileirarMedidas(
    estacao: { id: string; parametros?: { id: string; tipoParametro: { nome: string } }[] },
    leituras: Record<string, number>,
    unixtime: number,
  ): void {
    // O nome do sensor no payload casa com o "nome" do tipoParametro
    // configurado para a estação (é o mesmo mapa que /parametros expõe para
    // o datalogger aprender). Leituras sem tipoParametro correspondente são
    // descartadas aqui — já foram preservadas intactas em leituras_brutas.
    const mapaParametros = new Map((estacao.parametros ?? []).map((p) => [p.tipoParametro.nome, p.id]));

    for (const [nome, valor] of Object.entries(leituras)) {
      const parametroId = mapaParametros.get(nome);
      if (!parametroId) continue;
      this.loteMedidas.push({ parametroId, estacaoId: estacao.id, valor, unixtime });
    }
  }

  /** Grava os dois lotes acumulados. Público para permitir flush manual (testes, shutdown). */
  flush(): Promise<void> {
    if (this.flushNaFila) return this.flushNaFila;

    const proximo = this.flushEmAndamento.then(() => {
      this.flushNaFila = undefined;
      return this.gravarLotes();
    });
    this.flushNaFila = proximo;
    this.flushEmAndamento = proximo;
    return proximo;
  }

  private async gravarLotes(): Promise<void> {
    const brutas = this.loteBrutas;
    const medidas = this.loteMedidas;
    this.loteBrutas = [];
    this.loteMedidas = [];
    this.emGravacao = {
      brutas: [...this.falhasBrutas.flatMap((lote) => lote.itens), ...brutas],
      medidas: [...this.falhasMedidas.flatMap((lote) => lote.itens), ...medidas],
    };

    [this.falhasBrutas, this.falhasMedidas] = await Promise.all([
      this.gravarComNovaTentativa('leitura(s) bruta(s)', brutas, this.falhasBrutas, (itens) =>
        this.telemetria.registrarLeiturasBrutas(itens),
      ),
      this.gravarComNovaTentativa('medida(s)', medidas, this.falhasMedidas, (itens) =>
        this.telemetria.registrarMedidas(itens),
      ),
    ]);
    this.emGravacao = undefined;
  }

  /**
   * Grava as falhas anteriores junto com os itens novos, num INSERT só. Se
   * falhar, devolve tudo para a próxima tentativa; a parte que já esgotou as
   * tentativas é descartada com log de erro trazendo os itens (ver
   * registrarDescarte), para dar para
   * recuperar a partir do log. Regravar não duplica nada: as leituras brutas
   * têm id fixo e as medidas o índice único (parametroId, unixtime), os dois
   * com ON CONFLICT DO NOTHING.
   */
  private async gravarComNovaTentativa<T>(
    descricao: string,
    novos: T[],
    falhas: LoteComFalha<T>[],
    gravar: (itens: T[]) => Promise<number>,
  ): Promise<LoteComFalha<T>[]> {
    const lotes = novos.length > 0 ? [...falhas, { itens: novos, tentativas: 0 }] : falhas;
    if (lotes.length === 0) return [];

    try {
      await gravar(lotes.flatMap((lote) => lote.itens));
      return [];
    } catch (erro) {
      const restantes: LoteComFalha<T>[] = [];
      for (const lote of lotes) {
        const tentativas = lote.tentativas + 1;
        if (tentativas < this.tentativasMaximas) {
          restantes.push({ itens: lote.itens, tentativas });
          continue;
        }
        this.registrarDescarte(
          descricao,
          lote.itens,
          `${tentativas} tentativa(s) de gravação: ${(erro as Error).message}`,
          (erro as Error).stack,
        );
      }

      const pendentes = restantes.reduce((total, lote) => total + lote.itens.length, 0);
      if (pendentes > 0) {
        this.logger.warn(
          `Falha ao gravar ${descricao}; ${pendentes} item(ns) volta(m) para a próxima tentativa: ${(erro as Error).message}`,
        );
      }
      return restantes;
    }
  }

  /** Log de erro com os itens descartados em JSON, em pedaços, para recuperar a partir do log. */
  private registrarDescarte<T>(descricao: string, itens: T[], motivo: string, pilha?: string): void {
    if (itens.length === 0) return;

    this.logger.error(`Descartando ${itens.length} ${descricao} após ${motivo}`, pilha);
    for (let inicio = 0; inicio < itens.length; inicio += ITENS_POR_LINHA_DE_LOG) {
      const pedaco = itens.slice(inicio, inicio + ITENS_POR_LINHA_DE_LOG);
      this.logger.error(
        `Itens descartados (${descricao}, ${inicio + 1}-${inicio + pedaco.length} de ${itens.length}): ${JSON.stringify(pedaco)}`,
      );
    }
  }

  private temFalhasPendentes(): boolean {
    return this.falhasBrutas.length > 0 || this.falhasMedidas.length > 0;
  }

  async listarParametros(vid: string): Promise<EstacaoParametrosRespostaDto> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { vid },
      select: {
        id: true,
        vid: true,
        nome: true,
        parametros: {
          select: {
            tipoParametro: { select: { id: true, nome: true, unidade: true, fator: true, ganho: true } },
          },
        },
      },
    });

    if (!estacao) {
      throw new NotFoundException(`Nenhuma estação cadastrada para o vid "${vid}"`);
    }

    return new EstacaoParametrosRespostaDto(
      estacao.id,
      estacao.vid,
      estacao.nome,
      estacao.parametros.map(({ tipoParametro }) => ({
        tipoParametroId: tipoParametro.id,
        nome: tipoParametro.nome,
        unidade: tipoParametro.unidade,
        fator: tipoParametro.fator,
        ganho: tipoParametro.ganho,
      })),
    );
  }
}
