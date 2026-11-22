import type { ConfigService } from '@nestjs/config';
import { connectAsync, type MqttClient } from 'mqtt';
import { BrokerService } from '../../src/broker/broker.service';
import { topicoTelemetria, TOPICO_TELEMETRIA_ASSINATURA } from '../../src/broker/topicos';

// Contra um Mosquitto de verdade (o do docker-compose.yml): só roda com
// MQTT_URL_TESTE definido, porque o CI não sobe broker. Ex.:
//   MQTT_URL_TESTE=mqtt://localhost:1883 npm run test:functional -- broker
const URL_BROKER = process.env.MQTT_URL_TESTE;
const config = {
  get: (chave: string) =>
    ({
      MQTT_URL: URL_BROKER,
      MQTT_ADMIN_USUARIO: process.env.MQTT_ADMIN_USUARIO_TESTE ?? 'admin',
      MQTT_ADMIN_SENHA: process.env.MQTT_ADMIN_SENHA_TESTE ?? 'admin-dev',
    })[chave],
} as unknown as ConfigService;

(URL_BROKER ? describe : describe.skip)('Cadastro das estações no broker (funcional, broker real)', () => {
  const broker = new BrokerService(config);
  const vid = `teste-broker-${Date.now()}`;
  const clientes: MqttClient[] = [];

  const conectar = async (usuario: string, senha: string) => {
    const cliente = await connectAsync(URL_BROKER!, { username: usuario, password: senha, reconnectPeriod: 0, connectTimeout: 3000 });
    clientes.push(cliente);
    return cliente;
  };

  afterAll(async () => {
    await broker.removerEstacao(vid);
    await Promise.all(clientes.map((cliente) => cliente.endAsync()));
    await broker.onModuleDestroy();
  });

  it('a estação entra com a própria chave e a chave errada é recusada', async () => {
    await broker.cadastrarEstacao(vid, 'chave-certa');

    await expect(conectar(vid, 'chave-certa')).resolves.toBeDefined();
    await expect(conectar(vid, 'chave-errada')).rejects.toThrow(/Not authorized|Bad user/);
  });

  it('a estação só publica no próprio tópico', async () => {
    const assinante = await conectar('ingestao', process.env.MQTT_INGESTAO_SENHA_TESTE ?? 'ingestao-dev');
    const recebidas: string[] = [];
    assinante.on('message', (topico) => recebidas.push(topico));
    await assinante.subscribeAsync(TOPICO_TELEMETRIA_ASSINATURA, { qos: 1 });

    const estacao = await conectar(vid, 'chave-certa');
    await estacao.publishAsync(topicoTelemetria(vid), '{"leituras":{"a":1}}', { qos: 1 });
    await estacao.publishAsync(topicoTelemetria('outra-estacao'), '{"leituras":{"a":1}}', { qos: 1 });
    await new Promise((resolve) => setTimeout(resolve, 500));

    expect(recebidas).toEqual([topicoTelemetria(vid)]);
  });

  it('trocar a chave derruba a antiga na hora', async () => {
    await broker.cadastrarEstacao(vid, 'chave-nova');

    await expect(conectar(vid, 'chave-certa')).rejects.toThrow(/Not authorized|Bad user/);
    await expect(conectar(vid, 'chave-nova')).resolves.toBeDefined();
  });
});
