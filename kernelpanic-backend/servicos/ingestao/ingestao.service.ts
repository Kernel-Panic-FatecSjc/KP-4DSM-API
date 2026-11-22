import { randomUUID } from 'node:crypto';
import {
  BeforeApplicationShutdown,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { StatusOperacionalEstacao } from '../../src/generated/prisma/client';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EstacaoParametrosRespostaDto } from './http/dto/estacao-parametros-resposta.dto';
import { IngestaoRespostaDto } from './http/dto/ingestao-resposta.dto';
import { LeituraBrutaParaGravar, LeiturasBrutasRepositorio } from './leituras-brutas.repositorio';

/** Pacote já com o formato conferido (HTTP: DTO; MQTT: mesmo DTO + vid do tópico). */
export interface PacoteTelemetria {
  vid: string;
  unixtime?: number;
  latitude?: number;
  longitude?: number;
  leituras: Record<string, number>;
}

interface EstacaoConhecida {
  id: string;
  latitude: number;
  longitude: number;
  statusOperacional: StatusOperacionalEstacao;
  consultadaEm: number;
}

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
// Posição e status da estação mudam raramente: o cache poupa uma consulta por
// mensagem MQTT. A rota HTTP já consulta a estação na guarda da chave.
const VALIDADE_CACHE_ESTACAO_MS = 60_000;

const esperar = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms).unref?.());

/**
 * Serviço de ingestão (VPS 2 da arquitetura): recebe a telemetria (MQTT e,
 * como alternativa, HTTP) e só grava o pacote original em leituras_brutas. Não
 * gera medida, não confere faixa física nem estação inativa: isso é do serviço
 * de tratamento, que lê leituras_brutas em lotes.
 */
@Injectable()
export class IngestaoService implements OnModuleInit, BeforeApplicationShutdown {
  private readonly logger = new Logger(IngestaoService.name);

  // Buffer em memória: em vez de um INSERT por pacote, acumula e grava em
  // lotes (ver flush()).
  private lote: LeituraBrutaParaGravar[] = [];
  // Lotes que falharam ao gravar: entram de novo no próximo flush até
  // esgotar as tentativas, para não perder leitura já confirmada à estação.
  private falhas: LoteComFalha<LeituraBrutaParaGravar>[] = [];
  // Encadeia os flushes (timer, lote cheio, encerramento) para que dois não
  // peguem as mesmas falhas ao mesmo tempo. Fica no máximo um esperando: com
  // o banco lento, o lote cheio pediria um flush por pacote, e cada um
  // gastaria uma tentativa das falhas em sequência.
  private flushEmAndamento: Promise<void> = Promise.resolve();
  private flushNaFila?: Promise<void>;
  // O que está sendo gravado agora, para o log caso o encerramento estoure o prazo.
  private emGravacao?: LeituraBrutaParaGravar[];
  private encerrando = false;
  private timer?: NodeJS.Timeout;
  private readonly estacoes = new Map<string, EstacaoConhecida>();
  private readonly tamanhoLoteMaximo: number;
  private readonly intervaloFlushMs: number;
  private readonly tentativasMaximas: number;
  private readonly prazoEncerramentoMs: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly repositorio: LeiturasBrutasRepositorio,
    config: ConfigService,
  ) {
    this.tamanhoLoteMaximo = Number(config.get('INGESTAO_LOTE_TAMANHO_MAX') ?? 5000);
    // Curto: o critério da cadeia é a leitura virar medida em até 2 s, e o
    // tratamento só vê o pacote depois deste flush.
    this.intervaloFlushMs = Number(config.get('INGESTAO_LOTE_INTERVALO_MS') ?? 250);
    this.tentativasMaximas = Number(config.get('INGESTAO_LOTE_TENTATIVAS_MAX') ?? 5);
    this.prazoEncerramentoMs = Number(config.get('INGESTAO_ENCERRAMENTO_PRAZO_MS') ?? 8000);
  }

  onModuleInit(): void {
    this.timer = setInterval(() => void this.flush(), this.intervaloFlushMs);
    this.timer.unref?.();
  }

  // Roda no encerramento (SIGTERM, com enableShutdownHooks no main.ts), depois
  // do onModuleDestroy em que o assinante MQTT já se desconectou e terminou de
  // repassar o que tinha recebido: para de aceitar pacotes, grava o buffer e
  // insiste nas falhas até esgotar as tentativas ou o prazo. O prazo fica
  // abaixo dos 10 s do docker stop, para o descarte sair no log antes de um SIGKILL.
  async beforeApplicationShutdown(): Promise<void> {
    this.encerrando = true;
    clearInterval(this.timer);

    const prazo = Date.now() + this.prazoEncerramentoMs;
    const terminou = await Promise.race([
      this.drenar(prazo).then(() => true),
      esperar(this.prazoEncerramentoMs).then(() => false),
    ]);
    if (!terminou || this.falhas.length > 0) this.descartarNoEncerramento();
  }

  get emEncerramento(): boolean {
    return this.encerrando;
  }

  private async drenar(prazo: number): Promise<void> {
    await this.flush();
    while (this.falhas.length > 0 && Date.now() + PAUSA_ENTRE_TENTATIVAS_NO_ENCERRAMENTO_MS < prazo) {
      await esperar(PAUSA_ENTRE_TENTATIVAS_NO_ENCERRAMENTO_MS);
      await this.flush();
    }
  }

  private descartarNoEncerramento(): void {
    const pendentes = this.emGravacao ?? this.falhas.flatMap((lote) => lote.itens);
    const motivo = this.emGravacao
      ? `encerramento sem concluir a gravação em ${this.prazoEncerramentoMs} ms (podem ter sido gravados)`
      : 'encerramento com falhas ainda pendentes';
    this.registrarDescarte([...pendentes, ...this.lote], motivo);
  }

  /**
   * Põe o pacote no lote. A posição vem do pacote ou, se ele não trouxer, do
   * cadastro da estação (a coluna localizacao é obrigatória).
   */
  async receber(pacote: PacoteTelemetria): Promise<IngestaoRespostaDto> {
    const estacao = await this.localizarEstacao(pacote.vid);
    if (!estacao) {
      throw new NotFoundException(`Nenhuma estação cadastrada para o vid "${pacote.vid}"`);
    }

    // Conferido depois da consulta, logo antes de entrar no buffer: o que
    // entra a partir daqui não teria mais flush. 503 faz o datalogger reenviar.
    if (this.encerrando) {
      throw new ServiceUnavailableException('Ingestão em encerramento; reenvie a leitura');
    }

    const agora = Math.floor(Date.now() / 1000);
    // Gerado aqui, não pelo banco: a gravação só acontece no próximo flush,
    // mas a estação já recebe o id na resposta (202 = aceito, não gravado).
    const leituraBrutaId = randomUUID();

    this.lote.push({
      id: leituraBrutaId,
      vidEstacao: pacote.vid,
      payload: pacote.leituras,
      latitude: pacote.latitude ?? estacao.latitude,
      longitude: pacote.longitude ?? estacao.longitude,
      unixtimeDispositivo: pacote.unixtime ?? agora,
    });

    if (this.lote.length >= this.tamanhoLoteMaximo) {
      void this.flush();
    }

    return new IngestaoRespostaDto(
      leituraBrutaId,
      estacao.id,
      Object.keys(pacote.leituras).length,
      agora,
      // Só informativo: quem decide que o pacote não vira medida é o tratamento.
      estacao.statusOperacional === StatusOperacionalEstacao.INATIVA,
    );
  }

  private async localizarEstacao(vid: string): Promise<EstacaoConhecida | null> {
    const emCache = this.estacoes.get(vid);
    if (emCache && Date.now() - emCache.consultadaEm < VALIDADE_CACHE_ESTACAO_MS) return emCache;

    const estacao = await this.prisma.estacao.findUnique({
      where: { vid },
      select: { id: true, latitude: true, longitude: true, statusOperacional: true },
    });
    if (!estacao) {
      this.estacoes.delete(vid);
      return null;
    }
    const conhecida = { ...estacao, consultadaEm: Date.now() };
    this.estacoes.set(vid, conhecida);
    return conhecida;
  }

  /** Grava o lote acumulado. Público para permitir flush manual (testes, shutdown). */
  flush(): Promise<void> {
    if (this.flushNaFila) return this.flushNaFila;

    const proximo = this.flushEmAndamento.then(() => {
      this.flushNaFila = undefined;
      return this.gravarLote();
    });
    this.flushNaFila = proximo;
    this.flushEmAndamento = proximo;
    return proximo;
  }

  /**
   * Grava as falhas anteriores junto com os itens novos, num INSERT só. Se
   * falhar, devolve tudo para a próxima tentativa; a parte que já esgotou as
   * tentativas é descartada com log de erro trazendo os itens, para dar para
   * recuperar a partir do log. Regravar não duplica: o id da leitura é fixo e
   * o INSERT tem ON CONFLICT DO NOTHING.
   */
  private async gravarLote(): Promise<void> {
    const novos = this.lote;
    this.lote = [];
    const lotes = novos.length > 0 ? [...this.falhas, { itens: novos, tentativas: 0 }] : this.falhas;
    if (lotes.length === 0) return;

    this.emGravacao = lotes.flatMap((lote) => lote.itens);
    try {
      await this.repositorio.registrar(this.emGravacao);
      this.falhas = [];
    } catch (erro) {
      const restantes: LoteComFalha<LeituraBrutaParaGravar>[] = [];
      for (const lote of lotes) {
        const tentativas = lote.tentativas + 1;
        if (tentativas < this.tentativasMaximas) {
          restantes.push({ itens: lote.itens, tentativas });
          continue;
        }
        this.registrarDescarte(
          lote.itens,
          `${tentativas} tentativa(s) de gravação: ${(erro as Error).message}`,
          (erro as Error).stack,
        );
      }

      const pendentes = restantes.reduce((total, lote) => total + lote.itens.length, 0);
      if (pendentes > 0) {
        this.logger.warn(
          `Falha ao gravar leituras brutas; ${pendentes} item(ns) volta(m) para a próxima tentativa: ${(erro as Error).message}`,
        );
      }
      this.falhas = restantes;
    } finally {
      this.emGravacao = undefined;
    }
  }

  /** Log de erro com os itens descartados em JSON, em pedaços, para recuperar a partir do log. */
  private registrarDescarte(itens: LeituraBrutaParaGravar[], motivo: string, pilha?: string): void {
    if (itens.length === 0) return;

    this.logger.error(`Descartando ${itens.length} leitura(s) bruta(s) após ${motivo}`, pilha);
    for (let inicio = 0; inicio < itens.length; inicio += ITENS_POR_LINHA_DE_LOG) {
      const pedaco = itens.slice(inicio, inicio + ITENS_POR_LINHA_DE_LOG);
      this.logger.error(
        `Itens descartados (${inicio + 1}-${inicio + pedaco.length} de ${itens.length}): ${JSON.stringify(pedaco)}`,
      );
    }
  }

  /** 'falha' enquanto algum lote que falhou ao gravar ainda aguarda nova tentativa (usado pelo /saude). */
  obterEstadoFlush(): 'ok' | 'falha' {
    return this.falhas.length > 0 ? 'falha' : 'ok';
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
