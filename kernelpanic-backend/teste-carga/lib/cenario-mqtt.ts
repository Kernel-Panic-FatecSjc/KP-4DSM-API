import { randomUUID } from 'node:crypto';
import { connectAsync } from 'mqtt';
import { papelDaEstacao, topicoTelemetria } from '../../src/broker/topicos';
import { garantirLicitacaoCarga, prepararEstacoesCarga } from './cenario-carga';
import type { Executor } from './simulador-esp32';

/** Chave de ingestão (senha no broker) das estações de teste: só serve para banco de carga/dev. */
export function chaveDaEstacaoDeCarga(vid: string): string {
  return `carga-${vid}`;
}

export interface ConfigBroker {
  url: string;
  usuario: string;
  senha: string;
}

export function configBrokerDoAmbiente(): ConfigBroker {
  return {
    url: process.env.MQTT_URL ?? 'mqtt://localhost:1883',
    usuario: process.env.MQTT_ADMIN_USUARIO ?? 'admin',
    senha: process.env.MQTT_ADMIN_SENHA ?? 'admin-dev',
  };
}

/**
 * Cria `quantidade` estações (vid = prefixo + número) na licitação de carga,
 * cada uma com chave própria, e as cadastra no broker como o backend faz
 * (usuário = vid, papel que só publica no próprio tópico). Devolve os vids.
 */
export async function prepararCenarioMqtt(
  executor: Executor,
  broker: ConfigBroker,
  prefixoVid: string,
  quantidade: number,
): Promise<string[]> {
  const cenario = await garantirLicitacaoCarga(executor);
  await prepararEstacoesCarga(executor, cenario, prefixoVid, quantidade, null);
  // SHA-256 da chave, igual a calcularHashChaveIngestao: a rota HTTP também aceita.
  await executor.query(
    `UPDATE estacoes SET "chaveIngestaoHash" = encode(sha256(convert_to('carga-' || vid, 'UTF8')), 'hex')
     WHERE vid LIKE $1`,
    [`${prefixoVid}%`],
  );
  const vids = Array.from({ length: quantidade }, (_, i) => `${prefixoVid}${String(i + 1).padStart(5, '0')}`);
  await cadastrarNoBroker(broker, vids);
  return vids;
}

const ESTACOES_POR_MENSAGEM = 100;

/**
 * Mesmos comandos do BrokerService, mas em lotes de 100 estações por mensagem
 * de controle: o dynamic-security regrava o arquivo de configuração a cada
 * mensagem, e milhares de estações uma a uma levariam minutos.
 */
export async function cadastrarNoBroker(broker: ConfigBroker, vids: string[]): Promise<void> {
  const cliente = await connectAsync(broker.url, { username: broker.usuario, password: broker.senha, reconnectPeriod: 0 });
  const pendentes = new Map<string, () => void>();
  cliente.on('message', (_topico, mensagem) => {
    const { responses } = JSON.parse(mensagem.toString()) as { responses: { correlationData?: string; error?: string; command: string }[] };
    for (const resposta of responses) {
      if (resposta.error && !resposta.command.startsWith('delete')) {
        console.warn(`broker: ${resposta.command}: ${resposta.error}`);
      }
      if (resposta.correlationData) pendentes.get(resposta.correlationData)?.();
    }
  });
  await cliente.subscribeAsync('$CONTROL/dynamic-security/v1/response', { qos: 1 });

  for (let inicio = 0; inicio < vids.length; inicio += ESTACOES_POR_MENSAGEM) {
    const correlationData = randomUUID();
    const commands: Record<string, unknown>[] = vids.slice(inicio, inicio + ESTACOES_POR_MENSAGEM).flatMap((vid) => [
      { command: 'deleteClient', username: vid },
      { command: 'deleteRole', rolename: papelDaEstacao(vid) },
      {
        command: 'createRole',
        rolename: papelDaEstacao(vid),
        acls: [{ acltype: 'publishClientSend', topic: topicoTelemetria(vid), allow: true }],
      },
      { command: 'createClient', username: vid, password: chaveDaEstacaoDeCarga(vid), roles: [{ rolename: papelDaEstacao(vid) }] },
    ]);
    commands[commands.length - 1] = { ...commands[commands.length - 1], correlationData };
    const respondido = new Promise<void>((resolver) => pendentes.set(correlationData, resolver));
    await cliente.publishAsync('$CONTROL/dynamic-security/v1', JSON.stringify({ commands }), { qos: 1 });
    await respondido;
  }
  await cliente.endAsync();
}
