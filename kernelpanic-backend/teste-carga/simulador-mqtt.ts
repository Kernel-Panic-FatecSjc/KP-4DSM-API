import 'dotenv/config';
import { connectAsync, type MqttClient } from 'mqtt';
import { Client } from 'pg';
import { topicoTelemetria } from '../src/broker/topicos';
import { chaveDaEstacaoDeCarga, configBrokerDoAmbiente, prepararCenarioMqtt } from './lib/cenario-mqtt';
import { aleatorioEntre, dormir, gerarEstacoes, gerarPayload } from './lib/simulador-esp32';

/**
 * Simulador de estações: no lugar do antigo gerador que gravava direto no
 * banco, cada estação simulada é um cliente MQTT com a própria credencial e
 * publica no próprio tópico, como o datalogger real (docs/mqtt-topico-payload.md).
 * O caminho inteiro roda: broker → ingestão → leituras_brutas → tratamento →
 * medidas → alertas.
 *
 *   npm run simulador                         # 20 estações, uma leitura por minuto cada
 *   NUM_ESTACOES=200 INTERVALO_S=5 npm run simulador
 *
 * Na primeira vez (ou com SIMULADOR_PREPARAR=true) cria as estações na
 * licitação "CARGA" do banco de DATABASE_URL e cadastra as credenciais no
 * broker. Para em Ctrl+C ou depois de DURACAO_S segundos.
 */

const NUM_ESTACOES = Number(process.env.NUM_ESTACOES ?? 20);
const INTERVALO_S = Number(process.env.INTERVALO_S ?? 60);
const DURACAO_S = Number(process.env.DURACAO_S ?? Infinity);
const PREFIXO_VID = process.env.PREFIXO_VID ?? 'SIMULADOR-';
const PREPARAR = process.env.SIMULADOR_PREPARAR !== 'false';

async function main(): Promise<void> {
  const broker = configBrokerDoAmbiente();
  if (PREPARAR) {
    const banco = new Client({ connectionString: process.env.DATABASE_URL });
    await banco.connect();
    console.log(`Preparando ${NUM_ESTACOES} estações (${PREFIXO_VID}…) no banco e no broker...`);
    await prepararCenarioMqtt(banco, broker, PREFIXO_VID, NUM_ESTACOES);
    await banco.end();
  }

  const estacoes = gerarEstacoes(NUM_ESTACOES).map((estacao, i) => ({
    ...estacao,
    vid: `${PREFIXO_VID}${String(i + 1).padStart(5, '0')}`,
  }));
  const clientes: MqttClient[] = [];
  let publicadas = 0;
  let falhas = 0;

  for (const estacao of estacoes) {
    const cliente = await connectAsync(broker.url, {
      username: estacao.vid,
      password: chaveDaEstacaoDeCarga(estacao.vid),
      clientId: `simulador-${estacao.vid}`,
      reconnectPeriod: 2000,
    });
    clientes.push(cliente);

    const publicar = () => {
      const corpo = {
        unixtime: Math.floor(Date.now() / 1000),
        latitude: estacao.lat,
        longitude: estacao.lng,
        leituras: gerarPayload(estacao),
      };
      cliente
        .publishAsync(topicoTelemetria(estacao.vid), JSON.stringify(corpo), { qos: 1 })
        .then(() => publicadas++)
        .catch(() => falhas++);
    };
    // Primeira leitura espalhada no intervalo, para as estações não publicarem juntas.
    setTimeout(() => {
      publicar();
      setInterval(publicar, INTERVALO_S * 1000);
    }, aleatorioEntre(0, INTERVALO_S * 1000));
  }
  console.log(`${clientes.length} estações conectadas em ${broker.url}; uma leitura a cada ${INTERVALO_S}s por estação.`);

  const relatorio = setInterval(() => console.log(`publicadas: ${publicadas} | falhas: ${falhas}`), 10_000);
  const encerrar = async () => {
    clearInterval(relatorio);
    await Promise.all(clientes.map((cliente) => cliente.endAsync()));
    console.log(`fim: ${publicadas} publicadas, ${falhas} falhas`);
    process.exit(0);
  };
  process.on('SIGINT', () => void encerrar());
  if (Number.isFinite(DURACAO_S)) {
    await dormir(DURACAO_S * 1000);
    await encerrar();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
