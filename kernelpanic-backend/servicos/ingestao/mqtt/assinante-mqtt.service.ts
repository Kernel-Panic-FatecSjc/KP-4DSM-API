import { Injectable, Logger, OnApplicationBootstrap, OnModuleDestroy } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { connect, type MqttClient } from 'mqtt';
import { TOPICO_TELEMETRIA_ASSINATURA, vidDoTopico } from '../../../src/broker/topicos';
import { IngestaoService } from '../ingestao.service';
import { TelemetriaDto } from '../validacao/telemetria.dto';

export type EstadoMqtt = 'ok' | 'falha' | 'desligado';

/**
 * Assinante do broker (VPS 2 da arquitetura). Sessão persistente (clean:
 * false, clientId fixo) e QoS 1: enquanto o serviço está fora do ar, o broker
 * guarda as mensagens da assinatura e entrega quando ele volta.
 *
 * O MQTT.js confirma (PUBACK) cada mensagem ao recebê-la; confirmar só depois
 * de gravar serializaria a fila (o cliente só lê o pacote seguinte depois do
 * PUBACK do anterior). A janela que sobra é o lote em memória: ele é drenado
 * no encerramento normal (SIGTERM) e só se perde num SIGKILL ou queda da
 * máquina, no máximo um intervalo de flush (INGESTAO_LOTE_INTERVALO_MS).
 */
@Injectable()
export class AssinanteMqttService implements OnApplicationBootstrap, OnModuleDestroy {
  private readonly logger = new Logger(AssinanteMqttService.name);
  private cliente?: MqttClient;
  private readonly emAndamento = new Set<Promise<void>>();
  private recusadas = 0;

  constructor(
    private readonly ingestao: IngestaoService,
    private readonly config: ConfigService,
  ) {}

  onApplicationBootstrap(): void {
    const url = this.config.get<string>('MQTT_URL');
    if (!url) {
      this.logger.warn('MQTT_URL ausente: o serviço recebe só pela rota HTTP.');
      return;
    }

    // connect() e não connectAsync(): com a sessão persistente o broker entrega
    // a fila guardada logo após o CONNACK, e o handler de "message" precisa
    // estar registrado antes disso (senão a mensagem é confirmada e se perde).
    const cliente = connect(url, {
      clientId: this.config.get<string>('MQTT_INGESTAO_CLIENT_ID', 'ingestao'),
      username: this.config.get<string>('MQTT_INGESTAO_USUARIO', 'ingestao'),
      password: this.config.get<string>('MQTT_INGESTAO_SENHA'),
      clean: false,
      reconnectPeriod: 2000,
      connectTimeout: 10_000,
    });
    this.cliente = cliente;
    cliente.on('message', (topico, mensagem) => this.acompanhar(this.processar(topico, mensagem)));
    cliente.on('error', (erro) => this.logger.error(`Erro no MQTT: ${erro.message}`));
    cliente.on('offline', () => this.logger.warn('Desconectado do broker; reconectando'));
    // Não espera a conexão: com o broker fora do ar o serviço sobe mesmo assim
    // (a rota HTTP continua aceitando) e o cliente segue tentando. A assinatura
    // fica na sessão do broker; só é refeita quando a sessão não existe.
    cliente.on('connect', (connack) => {
      this.logger.log(`Conectado ao broker ${url} (sessão ${connack.sessionPresent ? 'retomada' : 'nova'})`);
      if (connack.sessionPresent) return;
      cliente
        .subscribeAsync(TOPICO_TELEMETRIA_ASSINATURA, { qos: 1 })
        .then(() => this.logger.log(`Assinando ${TOPICO_TELEMETRIA_ASSINATURA}`))
        .catch((erro: Error) => this.logger.error(`Falha ao assinar ${TOPICO_TELEMETRIA_ASSINATURA}: ${erro.message}`));
    });
  }

  // Antes do drain da ingestão (beforeApplicationShutdown): para de receber e
  // espera as mensagens já recebidas entrarem no lote.
  async onModuleDestroy(): Promise<void> {
    await this.cliente?.endAsync().catch(() => undefined);
    await Promise.allSettled(this.emAndamento);
  }

  estado(): EstadoMqtt {
    if (!this.cliente) return 'desligado';
    return this.cliente.connected ? 'ok' : 'falha';
  }

  get mensagensRecusadas(): number {
    return this.recusadas;
  }

  private acompanhar(tarefa: Promise<void>): void {
    this.emAndamento.add(tarefa);
    void tarefa.finally(() => this.emAndamento.delete(tarefa));
  }

  /** O vid vem do tópico (o broker garante que só a própria estação publica nele). */
  private async processar(topico: string, mensagem: Buffer): Promise<void> {
    const vid = vidDoTopico(topico);
    if (!vid) {
      this.recusar(topico, 'tópico fora do formato estacoes/{vid}/telemetria');
      return;
    }

    let corpo: unknown;
    try {
      corpo = JSON.parse(mensagem.toString('utf8'));
    } catch {
      this.recusar(topico, 'payload não é JSON');
      return;
    }

    const telemetria = plainToInstance(TelemetriaDto, corpo);
    const erros = typeof corpo === 'object' && corpo !== null ? await validate(telemetria, { whitelist: true }) : [];
    if (typeof corpo !== 'object' || corpo === null || erros.length > 0) {
      const detalhes = erros.flatMap((erro) => Object.values(erro.constraints ?? {})).join('; ');
      this.recusar(topico, detalhes || 'payload não é um objeto');
      return;
    }

    try {
      await this.ingestao.receber({ ...telemetria, vid });
    } catch (erro) {
      this.recusar(topico, (erro as Error).message);
    }
  }

  // A mensagem já foi confirmada ao broker: o motivo fica no log para quem
  // investigar a estação (o pacote mal formado não tem como virar leitura).
  private recusar(topico: string, motivo: string): void {
    this.recusadas += 1;
    this.logger.warn(`Mensagem recusada em ${topico}: ${motivo}`);
  }
}
