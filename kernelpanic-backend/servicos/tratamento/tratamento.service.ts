import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { PrismaService } from '../../src/prisma/prisma.service';
import { classificarLeitura, type EstacaoParaTratamento, type LeituraBrutaParaTratar } from './classificar-leituras';

export const FILA_LEITURAS_BRUTAS = 'leituras_brutas';
// Canal do pg_notify disparado pelo trigger de leituras_brutas a cada INSERT.
const CANAL_LEITURAS_NOVAS = 'leituras_brutas_novas';
const ESPERA_RECONEXAO_MS = 5000;

export interface ResultadoLote {
  leituras: number;
  medidas: number;
  erros: number;
}

interface Marcador {
  ultimoXid: bigint;
  ultimaLeituraId: string;
}

/**
 * Serviço de tratamento (VPS 4 da arquitetura). Lê leituras_brutas em lotes a
 * partir do marcador de controle_tratamento e, numa transação só, grava as
 * medidas (com a licitação da estação), as leituras recusadas em
 * leituras_erro e o novo marcador. Se algo falhar, nada do lote fica gravado e
 * ele é relido no próximo ciclo.
 *
 * O marcador é o par (xid da transação que gravou a leitura, id). Só entram no
 * lote leituras de transações já terminadas (xid abaixo do xmin do snapshot):
 * uma gravação que comita depois de outra mais nova não fica para trás do
 * marcador, mesmo com mais de uma instância da ingestão gravando.
 */
@Injectable()
export class TratamentoService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(TratamentoService.name);
  private readonly tamanhoLote: number;
  private readonly intervaloMs: number;
  private timer?: NodeJS.Timeout;
  private ouvinte: Client | null = null;
  private timerReconexao: NodeJS.Timeout | null = null;
  private encerrando = false;
  private ciclo: Promise<void> | null = null;
  private pendente = false;
  private ultimoCicloOk = true;
  private ultimoCicloEm: Date | null = null;
  private processadasDesdeInicio = 0;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {
    this.tamanhoLote = Number(config.get('TRATAMENTO_LOTE_TAMANHO') ?? 1000);
    // Varredura de segurança: o aviso do banco (LISTEN) é o gatilho normal.
    this.intervaloMs = Number(config.get('TRATAMENTO_INTERVALO_MS') ?? 1000);
  }

  async onApplicationBootstrap(): Promise<void> {
    await this.prisma.$executeRaw`
      INSERT INTO controle_tratamento (id) VALUES (${FILA_LEITURAS_BRUTAS}) ON CONFLICT (id) DO NOTHING`;
    this.timer = setInterval(() => this.agendar(), this.intervaloMs);
    await this.escutar();
    this.agendar();
  }

  async onModuleDestroy(): Promise<void> {
    this.encerrando = true;
    clearInterval(this.timer);
    if (this.timerReconexao) clearTimeout(this.timerReconexao);
    await this.ouvinte?.end().catch(() => undefined);
    // O lote em andamento termina (ou volta atrás inteiro): não há buffer a perder.
    await this.ciclo;
  }

  estado() {
    return {
      ultimoCicloOk: this.ultimoCicloOk,
      ultimoCicloEm: this.ultimoCicloEm,
      processadasDesdeInicio: this.processadasDesdeInicio,
      escutandoBanco: this.ouvinte !== null,
    };
  }

  /** Leituras brutas que ainda não passaram pelo tratamento. */
  async pendentes(): Promise<number> {
    const [linha] = await this.prisma.$queryRaw<{ total: bigint }[]>`
      SELECT COUNT(*) AS total FROM leituras_brutas lb, controle_tratamento c
      WHERE c.id = ${FILA_LEITURAS_BRUTAS}
        AND (lb."xidTransacao", lb.id) > (c."ultimoXid", c."ultimaLeituraId")`;
    return Number(linha?.total ?? 0n);
  }

  /** Pede um ciclo; avisos que chegam durante um ciclo viram um ciclo extra só. */
  agendar(): void {
    if (this.encerrando) return;
    if (this.ciclo) {
      this.pendente = true;
      return;
    }
    this.ciclo = this.rodarCiclo().finally(() => {
      this.ciclo = null;
    });
  }

  private async rodarCiclo(): Promise<void> {
    do {
      this.pendente = false;
      try {
        // Lote cheio: provavelmente há mais esperando, então segue sem pausa.
        let resultado: ResultadoLote;
        do {
          resultado = await this.processarLote();
        } while (resultado.leituras === this.tamanhoLote && !this.encerrando);
        this.ultimoCicloOk = true;
      } catch (erro) {
        this.ultimoCicloOk = false;
        this.logger.error('Falha ao tratar o lote; ele será relido no próximo ciclo', erro as Error);
      }
      this.ultimoCicloEm = new Date();
    } while (this.pendente && !this.encerrando);
  }

  /** Um lote, numa transação. Público para os testes chamarem sem esperar o timer. */
  async processarLote(): Promise<ResultadoLote> {
    const resultado = await this.prisma.$transaction(
      async (tx) => {
        // FOR UPDATE: duas instâncias do tratamento não pegam o mesmo lote.
        const [marcador] = await tx.$queryRaw<Marcador[]>`
          SELECT "ultimoXid", "ultimaLeituraId" FROM controle_tratamento
          WHERE id = ${FILA_LEITURAS_BRUTAS} FOR UPDATE`;
        const [{ limite }] = await tx.$queryRaw<{ limite: bigint }[]>`
          SELECT (pg_snapshot_xmin(pg_current_snapshot())::text)::bigint AS limite`;

        const leituras = await tx.$queryRaw<(LeituraBrutaParaTratar & { xidTransacao: bigint })[]>`
          SELECT id, "vidEstacao", payload, "unixtimeDispositivo", "xidTransacao"
          FROM leituras_brutas
          WHERE "xidTransacao" < ${limite}
            AND ("xidTransacao", id) > (${marcador.ultimoXid}::bigint, ${marcador.ultimaLeituraId}::text)
          ORDER BY "xidTransacao", id
          LIMIT ${this.tamanhoLote}`;
        if (leituras.length === 0) return { leituras: 0, medidas: 0, erros: 0 };

        const estacoes = await tx.estacao.findMany({
          where: { vid: { in: [...new Set(leituras.map((leitura) => leitura.vidEstacao))] } },
          select: {
            id: true,
            vid: true,
            licitacaoId: true,
            statusOperacional: true,
            parametros: {
              select: { id: true, tipoParametro: { select: { nome: true, valorMinimo: true, valorMaximo: true } } },
            },
          },
        });
        const porVid = new Map<string, EstacaoParaTratamento>(estacoes.map((estacao) => [estacao.vid, estacao]));

        const classificadas = leituras.map((leitura) => classificarLeitura(leitura, porVid.get(leitura.vidEstacao)));
        const medidas = classificadas.flatMap((classificacao) => classificacao.medidas);
        const erros = classificadas.flatMap((classificacao) => classificacao.erros);

        // Um INSERT para as medidas do lote: o trigger de alertas roda por
        // statement. skipDuplicates (ON CONFLICT DO NOTHING) é a deduplicação:
        // a estação que reenvia o mesmo instante não gera medida nem alarme de novo.
        if (medidas.length > 0) await tx.medida.createMany({ data: medidas, skipDuplicates: true });
        if (erros.length > 0) await tx.leituraErro.createMany({ data: erros, skipDuplicates: true });

        const ultima = leituras[leituras.length - 1];
        await tx.$executeRaw`
          UPDATE controle_tratamento
          SET "ultimoXid" = ${ultima.xidTransacao}, "ultimaLeituraId" = ${ultima.id},
              processadas = processadas + ${leituras.length}, "atualizadoEm" = now()
          WHERE id = ${FILA_LEITURAS_BRUTAS}`;

        return { leituras: leituras.length, medidas: medidas.length, erros: erros.length };
      },
      { timeout: 60_000 },
    );
    this.processadasDesdeInicio += resultado.leituras;
    return resultado;
  }

  /**
   * LISTEN numa conexão própria, fora do pool do Prisma (precisa ficar aberta).
   * Se cair, a varredura por intervalo segue funcionando enquanto reconecta.
   */
  private async escutar(): Promise<void> {
    const cliente = new Client({
      connectionString: this.config.get<string>('DATABASE_URL'),
      connectionTimeoutMillis: ESPERA_RECONEXAO_MS,
    });
    cliente.on('notification', () => this.agendar());
    cliente.on('error', (erro) => {
      this.logger.warn(`Conexão LISTEN caiu: ${erro.message}`);
      this.reconectar(cliente);
    });
    try {
      await cliente.connect();
      await cliente.query(`LISTEN ${CANAL_LEITURAS_NOVAS}`);
      this.ouvinte = cliente;
      this.logger.log(`Escutando "${CANAL_LEITURAS_NOVAS}"`);
    } catch (erro) {
      this.logger.warn(`Não foi possível escutar "${CANAL_LEITURAS_NOVAS}": ${String(erro)}`);
      this.reconectar(cliente);
    }
  }

  private reconectar(cliente: Client): void {
    if (this.ouvinte === cliente) this.ouvinte = null;
    void cliente.end().catch(() => undefined);
    if (this.encerrando || this.timerReconexao) return;
    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      void this.escutar();
    }, ESPERA_RECONEXAO_MS);
  }
}
