import 'dotenv/config';
import { Client } from 'pg';
import { dormir, gerarEstacoes, gerarPayload, inserirLote, type EstacaoSimulada } from './lib/simulador-esp32';

/**
 * Teste de taxa fixa: o gerador ESP32 produz leituras a um ritmo constante
 * (TAXA_POR_SEGUNDO), inseridas no banco em lote a cada segundo — o batch
 * insert é só o meio de escrita, não a origem dos dados. Serve para checar
 * se o banco sustenta uma taxa de ingestão constante sem acumular atraso.
 */

const TAXA_POR_SEGUNDO = Number(process.env.TAXA_POR_SEGUNDO ?? 500);
const DURACAO_SEGUNDOS = Number(process.env.DURACAO_SEGUNDOS ?? 5);
const NUM_ESTACOES = Number(process.env.NUM_ESTACOES ?? 2000);

function escolherEstacao(estacoes: EstacaoSimulada[]): EstacaoSimulada {
  return estacoes[Math.floor(Math.random() * estacoes.length)];
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const estacoes = gerarEstacoes(NUM_ESTACOES);
  const totalAlvo = TAXA_POR_SEGUNDO * DURACAO_SEGUNDOS;

  console.log(
    `Teste de taxa fixa: gerando ${TAXA_POR_SEGUNDO} registros/s via batch insert, ` +
      `por ${DURACAO_SEGUNDOS}s (${totalAlvo} registros no total, ${NUM_ESTACOES} estações simuladas).`,
  );

  let totalInserido = 0;
  let lotesAtrasados = 0;

  for (let segundo = 1; segundo <= DURACAO_SEGUNDOS; segundo++) {
    const inicioLote = Date.now();

    const leituras = Array.from({ length: TAXA_POR_SEGUNDO }, () => {
      const estacao = escolherEstacao(estacoes);
      return { estacao, payload: gerarPayload(estacao) };
    });

    await inserirLote(client, leituras);
    totalInserido += leituras.length;

    const duracaoLote = Date.now() - inicioLote;
    const dentroDoRitmo = duracaoLote <= 1000;
    if (!dentroDoRitmo) lotesAtrasados++;

    console.log(
      `[s${segundo}] ${leituras.length} registros inseridos em ${duracaoLote}ms` +
        (dentroDoRitmo ? ' — dentro do ritmo' : ` — ATRASO de ${duracaoLote - 1000}ms sobre o alvo de 1s`),
    );

    const espera = 1000 - duracaoLote;
    if (espera > 0) await dormir(espera);
  }

  console.log(
    `\nTotal: ${totalInserido} registros em ${DURACAO_SEGUNDOS}s de janela alvo ` +
      `(${lotesAtrasados}/${DURACAO_SEGUNDOS} lote(s) ultrapassaram 1s).`,
  );

  await client.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
