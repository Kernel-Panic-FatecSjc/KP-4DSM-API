import 'dotenv/config';
import { Client } from 'pg';
import {
  dormir,
  embaralhar,
  gerarEstacoes,
  gerarPayload,
  inserirLote,
  type EstacaoSimulada,
} from './lib/simulador-esp32';

const REGISTROS_POR_JANELA = Number(process.env.REGISTROS_POR_JANELA ?? 4000);
const DURACAO_JANELA_MS = Number(process.env.DURACAO_JANELA_MS ?? 60_000);
const INTERVALO_ESPERA_MS = Number(process.env.INTERVALO_ESPERA_MS ?? 4 * 60_000);
const NUM_ESTACOES = Number(process.env.NUM_ESTACOES ?? 2000);
const NUM_LOTES = Number(process.env.NUM_LOTES ?? 60);
const CICLOS = process.env.CICLOS ? Number(process.env.CICLOS) : Infinity;

async function executarJanela(
  client: Client,
  estacoes: EstacaoSimulada[],
  ciclo: number,
): Promise<void> {
  const inicio = Date.now();

  // duas passadas embaralhadas pelas estações ~ cada uma "reporta" 2x na janela,
  // completando REGISTROS_POR_JANELA quando NUM_ESTACOES * 2 == REGISTROS_POR_JANELA
  const eventos = [...embaralhar(estacoes), ...embaralhar(estacoes)].slice(0, REGISTROS_POR_JANELA);
  const tamanhoLote = Math.ceil(eventos.length / NUM_LOTES);
  let inseridos = 0;

  for (let lote = 0; lote < NUM_LOTES; lote++) {
    const inicioLote = lote * tamanhoLote;
    const fatia = eventos.slice(inicioLote, inicioLote + tamanhoLote);
    if (fatia.length === 0) break;

    const leituras = fatia.map((estacao) => ({ estacao, payload: gerarPayload(estacao) }));
    await inserirLote(client, leituras);
    inseridos += leituras.length;

    const decorrido = Date.now() - inicio;
    const alvoProximoLote = ((lote + 1) / NUM_LOTES) * DURACAO_JANELA_MS;
    const espera = alvoProximoLote - decorrido;
    if (espera > 0) await dormir(espera);
  }

  const duracaoReal = (Date.now() - inicio) / 1000;
  console.log(`[ciclo ${ciclo}] ${inseridos} leituras inseridas em ${duracaoReal.toFixed(1)}s`);
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(
    `Teste de carga: ${REGISTROS_POR_JANELA} registros / ${DURACAO_JANELA_MS / 1000}s, ` +
      `pausa de ${INTERVALO_ESPERA_MS / 1000}s, ${NUM_ESTACOES} estações simuladas.`,
  );

  const estacoes = gerarEstacoes(NUM_ESTACOES);

  let interromper = false;
  process.on('SIGINT', () => {
    console.log('\nInterrompido pelo usuário, finalizando após o ciclo atual...');
    interromper = true;
  });

  let ciclo = 1;
  while (ciclo <= CICLOS && !interromper) {
    await executarJanela(client, estacoes, ciclo);
    if (interromper || ciclo >= CICLOS) break;

    console.log(`Aguardando ${INTERVALO_ESPERA_MS / 1000}s até a próxima janela...`);
    await dormir(INTERVALO_ESPERA_MS);
    ciclo++;
  }

  await client.end();
  console.log('Teste de carga finalizado.');
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
