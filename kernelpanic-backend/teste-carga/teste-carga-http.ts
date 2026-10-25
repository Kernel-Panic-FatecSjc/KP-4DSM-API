import 'dotenv/config';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { Client } from 'pg';
import { resumirLatencias } from './lib/estatisticas';
import {
  CHAVE_CARGA_HTTP,
  PREFIXO_VID_HTTP,
  prepararCenarioHttp,
  SENSORES_POR_ESTACAO,
} from './lib/cenario-http';
import { dormir, gerarEstacoes, gerarPayload } from './lib/simulador-esp32';

/**
 * Teste de carga HTTP da ingestão: dispara POST /ingestao/telemetria (rota
 * alternativa ao MQTT do serviço de ingestão, servicos/ingestao) a taxas
 * crescentes (degraus, em requisições por segundo) para achar o pico que a API
 * sustenta, e mede por degrau a latência (p50/p95/p99/máx.), os códigos de
 * resposta e a perda de pacotes (202 aceitos x leituras que chegaram ao banco).
 * Passa pelo guard da chave e pelo buffer em lote, como um datalogger; as
 * medidas saem do serviço de tratamento, que precisa estar rodando. Para a
 * cadeia principal (broker MQTT), use teste-carga-mqtt.ts.
 *
 * Carga aberta (open loop): as requisições saem no ritmo do degrau mesmo que a
 * API atrase, como numa frota real, e não esperam a resposta anterior.
 * Para um teste contínuo, use um degrau só e uma duração longa:
 *   TAXAS=800 DURACAO_POR_TAXA=120 npm run teste:carga:http
 *
 * Use um banco só de carga (DATABASE_URL com "carga" no nome) e a API apontando
 * para ele: o script cria milhares de estações e de leituras.
 */

const URL_API = process.env.URL_API ?? `http://localhost:${process.env.INGESTAO_PORTA ?? 3002}`;
const NUM_ESTACOES = Number(process.env.NUM_ESTACOES ?? 2000);
const TAXAS = (process.env.TAXAS ?? '50,100,200,400,800,1600').split(',').map(Number);
const DURACAO_POR_TAXA = Number(process.env.DURACAO_POR_TAXA ?? 15);
const LIMITE_P95_MS = Number(process.env.LIMITE_P95_MS ?? 2000);
const TIMEOUT_MS = Number(process.env.TIMEOUT_MS ?? 10_000);
// Acima disso o gerador não abre mais requisições (contadas como "descartadas
// no gerador"): evita derrubar a própria máquina de teste com milhares de sockets.
const MAX_EM_VOO = Number(process.env.MAX_EM_VOO ?? 3000);

// Cada degrau usa uma faixa própria de unixtime, para contar à parte o que ele
// gravou; e cada execução, uma faixa abaixo de tudo que o teste já gravou (a
// unicidade de parametroId+unixtime descartaria, como duplicata, um valor
// repetido de uma execução anterior, e a contagem de perda sairia errada).
// Desce no passado, e não sobe: o unixtime não pode passar de "agora + 5 min",
// e subir a cada execução acabava batendo nesse limite (tudo vira 400).
const PASSO_UNIXTIME = 2000;
const FOLGA_ENTRE_EXECUCOES = 100_000;
let T0 = 0;

interface ResultadoDegrau {
  taxa: number;
  enviadas: number;
  aceitas: number;
  outrosStatus: Record<string, number>;
  erros: number;
  descartadasNoGerador: number;
  taxaEfetiva: number;
  p50: number;
  p95: number;
  p99: number;
  max: number;
  gravadas?: number;
  medidas?: number;
}

function tabela(resultados: ResultadoDegrau[]): string {
  const linhas = resultados.map((r) => {
    const perda = r.aceitas - (r.gravadas ?? 0);
    return (
      `| ${r.taxa} | ${r.taxaEfetiva.toFixed(0)} | ${r.p50.toFixed(0)} | ${r.p95.toFixed(0)} | ` +
      `${r.p99.toFixed(0)} | ${r.max.toFixed(0)} | ${r.aceitas}/${r.enviadas} | ${r.erros + r.descartadasNoGerador} | ${perda} |`
    );
  });
  return [
    '| Taxa alvo (req/s) | Taxa efetiva | p50 (ms) | p95 (ms) | p99 (ms) | máx (ms) | 202/enviadas | erros | perda (pacotes) |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...linhas,
  ].join('\n');
}

async function executarDegrau(
  indice: number,
  taxa: number,
  estacoes: ReturnType<typeof gerarEstacoes>,
): Promise<ResultadoDegrau> {
  const base = T0 + indice * PASSO_UNIXTIME;
  const contadores = new Int32Array(estacoes.length);
  const latencias: number[] = [];
  const status = new Map<number, number>();
  const pendentes = new Set<Promise<void>>();
  let enviadas = 0;
  let erros = 0;
  let descartadas = 0;
  let emVoo = 0;
  let proxima = 0;

  const disparar = () => {
    if (emVoo >= MAX_EM_VOO) {
      descartadas++;
      return;
    }
    const posicao = proxima++ % estacoes.length;
    const estacao = estacoes[posicao];
    const sequencia = ++contadores[posicao];
    if (sequencia >= PASSO_UNIXTIME) {
      throw new Error(`Cada estação enviou ${PASSO_UNIXTIME} leituras no degrau: aumente NUM_ESTACOES.`);
    }

    const corpo = JSON.stringify({
      vid: estacao.vid,
      unixtime: base + sequencia,
      leituras: gerarPayload(estacao),
    });
    const inicioRequisicao = performance.now();
    emVoo++;
    enviadas++;
    const requisicao: Promise<void> = fetch(`${URL_API}/ingestao/telemetria`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-chave-estacao': CHAVE_CARGA_HTTP },
      body: corpo,
      signal: AbortSignal.timeout(TIMEOUT_MS),
    })
      .then(async (resposta) => {
        await resposta.arrayBuffer();
        latencias.push(performance.now() - inicioRequisicao);
        status.set(resposta.status, (status.get(resposta.status) ?? 0) + 1);
      })
      .catch(() => {
        erros++;
      })
      .finally(() => {
        emVoo--;
        pendentes.delete(requisicao);
      });
    pendentes.add(requisicao);
  };

  const inicio = performance.now();
  for (;;) {
    const decorrido = performance.now() - inicio;
    if (decorrido >= DURACAO_POR_TAXA * 1000) break;
    const devidas = Math.floor((decorrido * taxa) / 1000) - (enviadas + descartadas);
    for (let i = 0; i < devidas; i++) disparar();
    await dormir(2);
  }
  const duracaoReal = (performance.now() - inicio) / 1000;
  await Promise.allSettled(pendentes);

  const aceitas = status.get(202) ?? 0;
  const outrosStatus: Record<string, number> = {};
  for (const [codigo, total] of status) if (codigo !== 202) outrosStatus[codigo] = total;

  return {
    taxa,
    enviadas,
    aceitas,
    outrosStatus,
    erros,
    descartadasNoGerador: descartadas,
    taxaEfetiva: enviadas / duracaoReal,
    ...resumirLatencias(latencias),
  };
}

async function contarGravado(client: Client, indice: number): Promise<{ brutas: number; medidas: number }> {
  const de = T0 + indice * PASSO_UNIXTIME;
  const ate = de + PASSO_UNIXTIME - 1;
  const { rows: brutas } = await client.query(
    `SELECT count(*)::int AS total FROM leituras_brutas
     WHERE "unixtimeDispositivo" BETWEEN $1 AND $2 AND "vidEstacao" LIKE $3`,
    [de, ate, `${PREFIXO_VID_HTTP}%`],
  );
  const { rows: medidas } = await client.query(
    `SELECT count(*)::int AS total FROM medidas m JOIN estacoes e ON e.id = m."estacaoId"
     WHERE m.unixtime BETWEEN $1 AND $2 AND e.vid LIKE $3`,
    [de, ate, `${PREFIXO_VID_HTTP}%`],
  );
  return { brutas: brutas[0].total, medidas: medidas[0].total };
}

async function main(): Promise<void> {
  const urlBanco = process.env.DATABASE_URL ?? '';
  if (!new URL(urlBanco).pathname.includes('carga')) {
    throw new Error(
      'DATABASE_URL precisa apontar para um banco de carga (nome com "carga"): este teste cria milhares de estações e leituras.',
    );
  }

  const client = new Client({ connectionString: urlBanco });
  await client.connect();

  console.log(`Preparando ${NUM_ESTACOES} estações (${SENSORES_POR_ESTACAO} sensores cada)...`);
  await prepararCenarioHttp(client, NUM_ESTACOES);
  const agora = Math.floor(Date.now() / 1000);
  const { rows: ultimo } = await client.query(
    `SELECT coalesce(min("unixtimeDispositivo"), $2::bigint) AS menor FROM leituras_brutas WHERE "vidEstacao" LIKE $1`,
    [`${PREFIXO_VID_HTTP}%`, agora - 1_000_000],
  );
  T0 = Number(ultimo[0].menor) - FOLGA_ENTRE_EXECUCOES;
  const estacoes = gerarEstacoes(NUM_ESTACOES).map((estacao, i) => ({
    ...estacao,
    vid: `${PREFIXO_VID_HTTP}${String(i + 1).padStart(5, '0')}`,
  }));

  console.log(
    `Ambiente: Node ${process.version}, ${cpus().length}× ${cpus()[0].model.trim()}, ` +
      `${(totalmem() / 1024 ** 3).toFixed(1)} GB de RAM. API: ${URL_API}. ` +
      `Degraus: ${TAXAS.join(', ')} req/s, ${DURACAO_POR_TAXA}s cada.\n`,
  );

  // aquecimento: conexões, JIT e cache do banco, fora da medição
  await executarDegrau(TAXAS.length + 5, 20, estacoes);

  const resultados: ResultadoDegrau[] = [];
  for (const [indice, taxa] of TAXAS.entries()) {
    const resultado = await executarDegrau(indice, taxa, estacoes);
    resultados.push(resultado);
    console.log(
      `[${taxa} req/s] efetiva ${resultado.taxaEfetiva.toFixed(0)}/s | p50 ${resultado.p50.toFixed(0)} ms | ` +
        `p95 ${resultado.p95.toFixed(0)} ms | p99 ${resultado.p99.toFixed(0)} ms | máx ${resultado.max.toFixed(0)} ms | ` +
        `202: ${resultado.aceitas}/${resultado.enviadas} | erros ${resultado.erros} | descartadas no gerador ${resultado.descartadasNoGerador}` +
        (Object.keys(resultado.outrosStatus).length ? ` | outros ${JSON.stringify(resultado.outrosStatus)}` : ''),
    );
  }

  // A ingestão grava em lote e o tratamento gera as medidas depois: espera as
  // contagens de medidas pararem de crescer.
  console.log('\nAguardando a ingestão e o tratamento gravarem o que ainda está em andamento...');
  let anterior = -1;
  for (let tentativa = 0; tentativa < 60; tentativa++) {
    let total = 0;
    for (let i = 0; i < resultados.length; i++) total += (await contarGravado(client, i)).medidas;
    const esperado = resultados.reduce((soma, r) => soma + r.aceitas * SENSORES_POR_ESTACAO, 0);
    if (total >= esperado || (total === anterior && tentativa > 5)) break;
    anterior = total;
    await dormir(1000);
  }
  for (const [indice, resultado] of resultados.entries()) {
    const { brutas, medidas } = await contarGravado(client, indice);
    resultado.gravadas = brutas;
    resultado.medidas = medidas;
  }

  console.log(`\n${tabela(resultados)}\n`);
  for (const r of resultados.filter((x) => Object.keys(x.outrosStatus).length > 0)) {
    console.log(`Atenção: degrau ${r.taxa} req/s recebeu códigos diferentes de 202: ${JSON.stringify(r.outrosStatus)}.`);
  }
  const faltantes = resultados.filter((r) => r.medidas !== r.aceitas * SENSORES_POR_ESTACAO);
  for (const r of faltantes) {
    console.log(`Atenção: degrau ${r.taxa} req/s: ${r.medidas} medidas para ${r.aceitas * SENSORES_POR_ESTACAO} esperadas.`);
  }

  const sustentaveis = resultados.filter(
    (r) =>
      r.p95 <= LIMITE_P95_MS &&
      r.erros === 0 &&
      r.descartadasNoGerador === 0 &&
      r.aceitas === r.enviadas &&
      r.aceitas === (r.gravadas ?? 0) &&
      r.taxaEfetiva >= r.taxa * 0.95,
  );
  const pico = sustentaveis.at(-1);
  console.log(
    pico
      ? `Maior degrau sustentado (p95 ≤ ${LIMITE_P95_MS} ms, sem erros nem perda): ${pico.taxa} req/s.`
      : `Nenhum degrau sustentou p95 ≤ ${LIMITE_P95_MS} ms sem erros nem perda.`,
  );

  await client.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
