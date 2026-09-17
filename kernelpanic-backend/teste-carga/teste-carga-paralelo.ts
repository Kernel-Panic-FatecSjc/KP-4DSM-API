import 'dotenv/config';
import { Pool } from 'pg';
import { dormir, gerarEstacoes, gerarPayload, inserirLote, type EstacaoSimulada } from './lib/simulador-esp32';

/**
 * Mesmo teste de taxa fixa, mas dividindo cada lote entre várias conexões
 * concorrentes (um Pool), para não esbarrar no teto de CPU single-thread do
 * processo Node ao gerar/serializar um lote gigante numa conexão só.
 */

const TAXA_POR_SEGUNDO = Number(process.env.TAXA_POR_SEGUNDO ?? 50000);
const DURACAO_SEGUNDOS = Number(process.env.DURACAO_SEGUNDOS ?? 8);
const NUM_ESTACOES = Number(process.env.NUM_ESTACOES ?? 2000);
const WORKERS = Number(process.env.WORKERS ?? 8);

function escolherEstacao(estacoes: EstacaoSimulada[]): EstacaoSimulada {
  return estacoes[Math.floor(Math.random() * estacoes.length)];
}

async function main(): Promise<void> {
  const pool = new Pool({ connectionString: process.env.DATABASE_URL, max: WORKERS });
  const estacoes = gerarEstacoes(NUM_ESTACOES);
  const porWorker = Math.ceil(TAXA_POR_SEGUNDO / WORKERS);
  const totalPorLote = porWorker * WORKERS;

  console.log(
    `Teste paralelo: ${totalPorLote} registros/s com ${WORKERS} conexões concorrentes ` +
      `(${porWorker}/conexão), por ${DURACAO_SEGUNDOS}s (${totalPorLote * DURACAO_SEGUNDOS} registros no total).`,
  );

  let totalInserido = 0;
  let lotesAtrasados = 0;

  for (let segundo = 1; segundo <= DURACAO_SEGUNDOS; segundo++) {
    const inicioLote = Date.now();

    const tarefas = Array.from({ length: WORKERS }, () => {
      const leituras = Array.from({ length: porWorker }, () => {
        const estacao = escolherEstacao(estacoes);
        return { estacao, payload: gerarPayload(estacao) };
      });
      return inserirLote(pool, leituras);
    });

    await Promise.all(tarefas);
    totalInserido += totalPorLote;

    const duracaoLote = Date.now() - inicioLote;
    const dentroDoRitmo = duracaoLote <= 1000;
    if (!dentroDoRitmo) lotesAtrasados++;

    console.log(
      `[s${segundo}] ${totalPorLote} registros (${WORKERS}x${porWorker}) inseridos em ${duracaoLote}ms` +
        (dentroDoRitmo ? ' — dentro do ritmo' : ` — ATRASO de ${duracaoLote - 1000}ms sobre o alvo de 1s`),
    );

    const espera = 1000 - duracaoLote;
    if (espera > 0) await dormir(espera);
  }

  console.log(
    `\nTotal: ${totalInserido} registros em ${DURACAO_SEGUNDOS}s de janela alvo ` +
      `(${lotesAtrasados}/${DURACAO_SEGUNDOS} lote(s) ultrapassaram 1s, ${WORKERS} conexões concorrentes).`,
  );

  await pool.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
