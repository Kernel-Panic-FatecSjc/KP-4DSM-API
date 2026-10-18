import { randomUUID } from 'node:crypto';
import { Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
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
  // peguem as mesmas falhas ao mesmo tempo.
  private flushEmAndamento: Promise<void> = Promise.resolve();
  private timer?: NodeJS.Timeout;
  private readonly tamanhoLoteMaximo: number;
  private readonly intervaloFlushMs: number;
  private readonly tentativasMaximas: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly telemetria: TelemetriaService,
    config: ConfigService,
  ) {
    this.tamanhoLoteMaximo = Number(config.get('INGESTAO_LOTE_TAMANHO_MAX') ?? 5000);
    this.intervaloFlushMs = Number(config.get('INGESTAO_LOTE_INTERVALO_MS') ?? 2000);
    this.tentativasMaximas = Number(config.get('INGESTAO_LOTE_TENTATIVAS_MAX') ?? 5);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), this.intervaloFlushMs);
    this.timer.unref?.();
  }

  // Roda no encerramento (SIGTERM, com enableShutdownHooks no main.ts): grava
  // o que está no buffer e insiste nas falhas até esgotar as tentativas.
  async onModuleDestroy(): Promise<void> {
    clearInterval(this.timer);
    await this.flush();
    while (this.temFalhasPendentes()) {
      await new Promise((resolve) => setTimeout(resolve, PAUSA_ENTRE_TENTATIVAS_NO_ENCERRAMENTO_MS));
      await this.flush();
    }
  }

  async ingerir(payload: IngerirTelemetriaDto): Promise<IngestaoRespostaDto> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { vid: payload.vid },
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
    this.flushEmAndamento = this.flushEmAndamento.then(() => this.gravarLotes());
    return this.flushEmAndamento;
  }

  private async gravarLotes(): Promise<void> {
    const brutas = this.loteBrutas;
    const medidas = this.loteMedidas;
    this.loteBrutas = [];
    this.loteMedidas = [];

    [this.falhasBrutas, this.falhasMedidas] = await Promise.all([
      this.gravarComNovaTentativa('leitura(s) bruta(s)', brutas, this.falhasBrutas, (itens) =>
        this.telemetria.registrarLeiturasBrutas(itens),
      ),
      this.gravarComNovaTentativa('medida(s)', medidas, this.falhasMedidas, (itens) =>
        this.telemetria.registrarMedidas(itens),
      ),
    ]);
  }

  /**
   * Grava as falhas anteriores junto com os itens novos, num INSERT só. Se
   * falhar, devolve tudo para a próxima tentativa; a parte que já esgotou as
   * tentativas é descartada com log de erro trazendo os itens, para dar para
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
        this.logger.error(
          `Descartando ${lote.itens.length} ${descricao} após ${tentativas} tentativa(s) de gravação: ` +
            `${(erro as Error).message}. Itens: ${JSON.stringify(lote.itens)}`,
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
