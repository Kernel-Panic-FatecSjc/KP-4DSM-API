import 'dotenv/config';
import { Client } from 'pg';
import { aleatorioEntre, dormir } from './lib/simulador-esp32';
import { type EstacaoComAlerta, NOME_TIPO_PARAMETRO_CARGA, prepararCenarioAlertas } from './lib/preparar-cenario-alertas';

/**
 * Teste de carga ponta-a-ponta: diferente dos outros (que escrevem direto em
 * leituras_brutas), este passa pela rota HTTP de ingestão de verdade — o
 * mesmo caminho que um ESP32 real usaria — para provar que o lote de
 * medidas e o trigger de alertas disparam alarmes de fato. Cria estações
 * fakes com um alerta cada (ver preparar-cenario-alertas.ts) e manda
 * leituras que cruzam o limite com frequência.
 */

const BASE_URL = process.env.INGESTAO_URL ?? `http://localhost:${process.env.PORT ?? 3001}`;
const CHAVE_INGESTAO = process.env.INGESTAO_CHAVE_API ?? '';
const NUM_ESTACOES = Number(process.env.NUM_ESTACOES ?? 200);
const TAXA_POR_SEGUNDO = Number(process.env.TAXA_POR_SEGUNDO ?? 200);
const DURACAO_SEGUNDOS = Number(process.env.DURACAO_SEGUNDOS ?? 10);
// dispara no máximo N requisições HTTP ao mesmo tempo — sem isso, uma rajada
// de milhares de fetch() simultâneos estoura o limite de conexões TCP do
// loopback (mesmo problema que teste-carga-paralelo.ts resolve com um Pool).
const CONEXOES_CONCORRENTES = Number(process.env.CONEXOES_CONCORRENTES ?? 100);
// margem sobre o INGESTAO_LOTE_INTERVALO_MS do serviço, para o último lote
// já ter sido gravado (e o trigger já ter rodado) antes de contarmos os alarmes
const ESPERA_FLUSH_MS = Number(process.env.ESPERA_FLUSH_MS ?? 4000);

function escolher<T>(itens: T[]): T {
  return itens[Math.floor(Math.random() * itens.length)];
}

async function enviarLeitura(estacao: EstacaoComAlerta): Promise<boolean> {
  const temperatura = Number((estacao.baseTemperatura + aleatorioEntre(-1, 1)).toFixed(1));

  const resposta = await fetch(`${BASE_URL}/ingestao/telemetria`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(CHAVE_INGESTAO ? { 'x-chave-estacao': CHAVE_INGESTAO } : {}),
    },
    body: JSON.stringify({ vid: estacao.vid, leituras: { [NOME_TIPO_PARAMETRO_CARGA]: temperatura } }),
  });

  return resposta.ok;
}

async function enviarRajada(
  estacoes: EstacaoComAlerta[],
  quantidade: number,
): Promise<{ ok: number; falhas: number }> {
  let proximo = 0;
  let ok = 0;
  let falhas = 0;

  async function worker(): Promise<void> {
    while (proximo < quantidade) {
      proximo++;
      if (await enviarLeitura(escolher(estacoes))) ok++;
      else falhas++;
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(CONEXOES_CONCORRENTES, quantidade) }, worker),
  );

  return { ok, falhas };
}

async function contarAlarmes(client: Client, alertaIds: string[]): Promise<number> {
  const { rows } = await client.query<{ total: string }>(
    'SELECT count(*)::text AS total FROM alarmes WHERE "alertaId" = ANY($1)',
    [alertaIds],
  );
  return Number(rows[0].total);
}

async function main(): Promise<void> {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  console.log(`Preparando cenário: ${NUM_ESTACOES} estação(ões) fake(s) com alerta cada...`);
  const estacoes = await prepararCenarioAlertas(client, NUM_ESTACOES);

  console.log(
    `Disparando ${TAXA_POR_SEGUNDO} leitura(s)/s contra ${BASE_URL}/ingestao/telemetria, ` +
      `por ${DURACAO_SEGUNDOS}s (${TAXA_POR_SEGUNDO * DURACAO_SEGUNDOS} requisições no total).`,
  );

  let enviadas = 0;
  let falhas = 0;

  for (let segundo = 1; segundo <= DURACAO_SEGUNDOS; segundo++) {
    const inicio = Date.now();

    const { ok, falhas: falhasRajada } = await enviarRajada(estacoes, TAXA_POR_SEGUNDO);
    enviadas += ok + falhasRajada;
    falhas += falhasRajada;

    const duracao = Date.now() - inicio;
    console.log(`[s${segundo}] ${ok + falhasRajada} requisições em ${duracao}ms (${falhasRajada} falha(s))`);

    const espera = 1000 - duracao;
    if (espera > 0) await dormir(espera);
  }

  console.log(`\n${enviadas} leitura(s) enviada(s), ${falhas} falha(s) HTTP.`);
  console.log(`Aguardando ${ESPERA_FLUSH_MS}ms para o último lote de medidas ser gravado...`);
  await dormir(ESPERA_FLUSH_MS);

  const alertaIds = estacoes.map((e) => e.alertaId);
  const totalAlarmes = await contarAlarmes(client, alertaIds);
  console.log(`Alarmes disparados pelo trigger para este cenário: ${totalAlarmes}`);

  await client.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
