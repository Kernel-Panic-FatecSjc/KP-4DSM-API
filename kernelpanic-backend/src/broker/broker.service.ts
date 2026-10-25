import { Injectable, Logger, OnModuleDestroy, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { randomUUID } from 'node:crypto';
import { connectAsync, type MqttClient } from 'mqtt';
import { papelDaEstacao, topicoTelemetria } from './topicos';

const TOPICO_CONTROLE = '$CONTROL/dynamic-security/v1';
const TOPICO_RESPOSTA = `${TOPICO_CONTROLE}/response`;
const PRAZO_RESPOSTA_MS = 5000;

interface Comando {
  command: string;
  [campo: string]: unknown;
}

interface RespostaComando {
  command: string;
  error?: string;
  correlationData?: string;
}

/**
 * Cadastro das estações no broker (Mosquitto com o plugin dynamic-security).
 * Cada estação vira um cliente MQTT com usuário = vid e senha = chave de
 * ingestão, e um papel que só deixa publicar em estacoes/{vid}/telemetria: uma
 * credencial errada é recusada na conexão, e uma estação não publica em nome
 * de outra. Sem MQTT_URL (desenvolvimento, testes) o cadastro é pulado.
 */
@Injectable()
export class BrokerService implements OnModuleDestroy {
  private readonly logger = new Logger(BrokerService.name);
  private readonly url?: string;
  private readonly usuario?: string;
  private readonly senha?: string;
  private cliente?: Promise<MqttClient>;
  private readonly pendentes = new Map<string, (resposta: RespostaComando) => void>();

  constructor(config: ConfigService) {
    this.url = config.get<string>('MQTT_URL') || undefined;
    this.usuario = config.get<string>('MQTT_ADMIN_USUARIO');
    this.senha = config.get<string>('MQTT_ADMIN_SENHA');
    if (!this.url) {
      this.logger.warn('MQTT_URL ausente: estações não serão cadastradas no broker (só a rota HTTP da ingestão aceita a chave).');
    }
  }

  get habilitado(): boolean {
    return Boolean(this.url);
  }

  async onModuleDestroy(): Promise<void> {
    const cliente = await this.cliente?.catch(() => undefined);
    await cliente?.endAsync().catch(() => undefined);
  }

  /** Cria (ou recria) o cliente e o papel da estação com a chave informada. */
  async cadastrarEstacao(vid: string, chave: string): Promise<void> {
    if (!this.habilitado) return;
    // Remover antes torna a operação idempotente: o erro de "não existe" é ignorado.
    await this.executar([{ command: 'deleteClient', username: vid }, { command: 'deleteRole', rolename: papelDaEstacao(vid) }], true);
    await this.executar([
      {
        command: 'createRole',
        rolename: papelDaEstacao(vid),
        acls: [{ acltype: 'publishClientSend', topic: topicoTelemetria(vid), allow: true }],
      },
      { command: 'createClient', username: vid, password: chave, roles: [{ rolename: papelDaEstacao(vid) }] },
    ]);
  }

  /** Tira a estação do broker (ex.: o vid mudou e a chave antiga não vale mais). */
  async removerEstacao(vid: string): Promise<void> {
    if (!this.habilitado) return;
    await this.executar([{ command: 'deleteClient', username: vid }, { command: 'deleteRole', rolename: papelDaEstacao(vid) }], true);
  }

  private async executar(comandos: Comando[], ignorarErros = false): Promise<void> {
    let cliente: MqttClient;
    try {
      cliente = await this.conectar();
    } catch (erro) {
      this.logger.error(`Broker indisponível: ${(erro as Error).message}`);
      throw new ServiceUnavailableException('Broker MQTT indisponível; tente de novo em instantes');
    }

    const respostas = comandos.map((comando) => {
      const correlationData = randomUUID();
      comando.correlationData = correlationData;
      return new Promise<RespostaComando>((resolver, rejeitar) => {
        const prazo = setTimeout(() => {
          this.pendentes.delete(correlationData);
          rejeitar(new ServiceUnavailableException('O broker MQTT não respondeu ao cadastro da estação'));
        }, PRAZO_RESPOSTA_MS);
        this.pendentes.set(correlationData, (resposta) => {
          clearTimeout(prazo);
          resolver(resposta);
        });
      });
    });

    await cliente.publishAsync(TOPICO_CONTROLE, JSON.stringify({ commands: comandos }), { qos: 1 });
    const resultados = await Promise.all(respostas);
    const falhas = resultados.filter((resposta) => resposta.error);
    if (falhas.length > 0 && !ignorarErros) {
      const detalhes = falhas.map((falha) => `${falha.command}: ${falha.error}`).join('; ');
      this.logger.error(`Broker recusou o cadastro: ${detalhes}`);
      throw new ServiceUnavailableException(`O broker MQTT recusou o cadastro da estação (${detalhes})`);
    }
  }

  private conectar(): Promise<MqttClient> {
    this.cliente ??= (async () => {
      const cliente = await connectAsync(this.url!, {
        username: this.usuario,
        password: this.senha,
        clientId: `backend-${randomUUID().slice(0, 8)}`,
        connectTimeout: PRAZO_RESPOSTA_MS,
        reconnectPeriod: 2000,
      });
      cliente.on('message', (_topico, mensagem) => this.receber(mensagem));
      await cliente.subscribeAsync(TOPICO_RESPOSTA, { qos: 1 });
      return cliente;
    })().catch((erro: unknown) => {
      this.cliente = undefined;
      throw erro;
    });
    return this.cliente;
  }

  private receber(mensagem: Buffer): void {
    try {
      const { responses } = JSON.parse(mensagem.toString()) as { responses?: RespostaComando[] };
      for (const resposta of responses ?? []) {
        if (resposta.correlationData) this.pendentes.get(resposta.correlationData)?.(resposta);
        if (resposta.correlationData) this.pendentes.delete(resposta.correlationData);
      }
    } catch {
      this.logger.warn('Resposta do dynamic-security ilegível; ignorada');
    }
  }
}
