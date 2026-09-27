import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Client } from 'pg';
import { PrismaService } from '../../prisma/prisma.service';
import { AlarmesService } from '../alarmes.service';
import type { AlarmeHistoricoRespostaDto } from '../dto/alarme-historico-resposta.dto';
import { AlarmesGateway, type AlarmeComPosicao } from './alarmes.gateway';

// Canal do pg_notify disparado pelo trigger avaliar_alertas_lote() depois do
// commit de cada lote de medidas que gerou alarmes.
const CANAL_NOVOS_ALARMES = 'novos_alarmes';

// A notificação traz só a quantidade de alarmes, então buscamos os disparados
// nesta janela e descartamos os já emitidos. A janela folgada cobre lotes que
// comitam fora de ordem (disparadoEm é o now() do início da transação).
const JANELA_MS = 5 * 60 * 1000;
const ESPERA_RECONEXAO_MS = 5000;

/**
 * Escuta o Postgres (LISTEN) e repassa os alarmes novos ao websocket.
 * Usa uma conexão própria, fora do pool do Prisma, porque o LISTEN precisa
 * de uma sessão que fique aberta o tempo todo.
 */
@Injectable()
export class AlarmesTempoRealService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AlarmesTempoRealService.name);
  private readonly emitidos = new Map<string, number>();
  private cliente: Client | null = null;
  private timerReconexao: NodeJS.Timeout | null = null;
  private encerrando = false;
  private processando = false;
  private pendente = false;

  constructor(
    private readonly alarmesService: AlarmesService,
    private readonly gateway: AlarmesGateway,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
  ) {}

  async onModuleInit(): Promise<void> {
    if (this.configService.get<string>('ALARMES_TEMPO_REAL', 'true') !== 'true') return;

    // Marca o que já existe como emitido, para um restart da API não
    // reabrir o modal de alarmes antigos em todos os clientes.
    await this.registrarJaExistentes().catch((erro: unknown) =>
      this.logger.warn(`Não foi possível carregar os alarmes recentes: ${String(erro)}`),
    );
    // Aguarda o LISTEN para a API só ficar pronta já escutando; se o banco
    // não responder, conectar() agenda nova tentativa e não trava a subida.
    await this.conectar();
  }

  async onModuleDestroy(): Promise<void> {
    this.encerrando = true;
    if (this.timerReconexao) clearTimeout(this.timerReconexao);
    await this.cliente?.end().catch(() => undefined);
  }

  /** Busca os alarmes recentes e emite os que ainda não foram enviados. */
  async processar(): Promise<void> {
    // Notificações que chegam durante uma busca viram uma única busca extra.
    if (this.processando) {
      this.pendente = true;
      return;
    }

    this.processando = true;
    try {
      do {
        this.pendente = false;
        const desde = new Date(Date.now() - JANELA_MS);
        const recentes = await this.alarmesService.buscarRecentes(desde);
        const novos = recentes.filter((alarme) => !this.emitidos.has(alarme.id));

        for (const alarme of novos) this.emitidos.set(alarme.id, new Date(alarme.disparadoEm).getTime());
        this.descartarAntigos(desde.getTime());

        if (novos.length > 0) this.gateway.emitirNovosAlarmes(await this.comPosicao(novos));
      } while (this.pendente);
    } catch (erro) {
      this.logger.error('Falha ao buscar alarmes novos para o tempo real', erro);
    } finally {
      this.processando = false;
    }
  }

  /** Anexa a posição da estação de cada alarme, para o gateway filtrar por região. */
  private async comPosicao(alarmes: AlarmeHistoricoRespostaDto[]): Promise<AlarmeComPosicao[]> {
    const estacoes = await this.prisma.estacao.findMany({
      where: { id: { in: [...new Set(alarmes.map((alarme) => alarme.estacao.id))] } },
      select: { id: true, latitude: true, longitude: true },
    });
    const posicoes = new Map(estacoes.map(({ id, latitude, longitude }) => [id, { latitude, longitude }]));
    return alarmes.flatMap((alarme) => {
      const posicao = posicoes.get(alarme.estacao.id);
      return posicao ? [{ alarme, posicao }] : [];
    });
  }

  private async registrarJaExistentes(): Promise<void> {
    const recentes = await this.alarmesService.buscarRecentes(new Date(Date.now() - JANELA_MS));
    for (const alarme of recentes) this.emitidos.set(alarme.id, new Date(alarme.disparadoEm).getTime());
  }

  private descartarAntigos(limite: number): void {
    for (const [id, disparadoEm] of this.emitidos) {
      if (disparadoEm < limite) this.emitidos.delete(id);
    }
  }

  private async conectar(): Promise<void> {
    const cliente = new Client({
      connectionString: this.configService.get<string>('DATABASE_URL'),
      connectionTimeoutMillis: ESPERA_RECONEXAO_MS,
    });
    cliente.on('notification', () => void this.processar());
    cliente.on('error', (erro) => {
      this.logger.warn(`Conexão de tempo real com o banco caiu: ${erro.message}`);
      this.reconectar(cliente);
    });

    try {
      await cliente.connect();
      await cliente.query(`LISTEN ${CANAL_NOVOS_ALARMES}`);
      this.cliente = cliente;
      this.logger.log(`Escutando "${CANAL_NOVOS_ALARMES}" para o tempo real de alarmes`);
      // Recupera o que tenha disparado enquanto estava desconectado.
      void this.processar();
    } catch (erro) {
      this.logger.warn(`Não foi possível escutar "${CANAL_NOVOS_ALARMES}": ${String(erro)}`);
      this.reconectar(cliente);
    }
  }

  private reconectar(cliente: Client): void {
    if (this.cliente === cliente) this.cliente = null;
    void cliente.end().catch(() => undefined);
    if (this.encerrando || this.timerReconexao) return;

    this.timerReconexao = setTimeout(() => {
      this.timerReconexao = null;
      void this.conectar();
    }, ESPERA_RECONEXAO_MS);
  }
}
