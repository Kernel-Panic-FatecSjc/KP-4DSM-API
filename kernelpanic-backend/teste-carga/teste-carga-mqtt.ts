import 'dotenv/config';
import { cpus, totalmem } from 'node:os';
import { performance } from 'node:perf_hooks';
import { connectAsync, type MqttClient } from 'mqtt';
import { Client } from 'pg';
import { topicoTelemetria } from '../src/broker/topicos';
import { SENSORES_CARGA } from './lib/cenario-carga';
import { chaveDaEstacaoDeCarga, configBrokerDoAmbiente, prepararCenarioMqtt } from './lib/cenario-mqtt';
import { resumirLatencias } from './lib/estatisticas';
import { dormir, gerarEstacoes, gerarPayload } from './lib/simulador-esp32';

/**
 * Teste de carga da cadeia de dados nova: estações publicam no broker (MQTT,
 * QoS 1), o serviço de ingestão grava em leituras_brutas e o de tratamento
 * gera as medidas. Mede por degrau de taxa (mensagens/s):
 * - a confirmação do broker (PUBACK), que é o que a estação espera;
 * - o tempo de ponta a ponta, da publicação até a medida existir no banco,
 *   numa amostra das mensagens (a meta do plano de QA: p95 abaixo de 2 s);
 * - a perda: publicadas x leituras_brutas x medidas.
 *
 * Carga aberta, como no teste HTTP: as mensagens saem no ritmo do degrau,
 * espalhadas entre as estações, cada uma com a própria conexão e credencial.
 * Cada execução cria estações novas (prefixo com a hora), para o unixtime de
 * uma execução não colidir com o de outra na deduplicação.
 *
 * Use um banco só de carga (DATABASE_URL com "carga" no nome), o broker do
 * docker-compose e os serviços de ingestão e tratamento apontando para esse banco.
 */

const NUM_ESTACOES = Number(process.env.NUM_ESTACOES ?? 1000);
const TAXAS = (process.env.TAXAS ?? '100,250,500,1000,1500').split(',').map(Number);
const DURACAO_POR_TAXA = Number(process.env.DURACAO_POR_TAXA ?? 15);
const LIMITE_P95_MS = Number(process.env.LIMITE_P95_MS ?? 2000);
// Uma em cada AMOSTRA mensagens tem o tempo de ponta a ponta medido.
const AMOSTRA = Number(process.env.AMOSTRA ?? 10);
const INTERVALO_SONDAGEM_MS = Number(process.env.INTERVALO_SONDAGEM_MS ?? 50);

// Cada degrau usa uma faixa própria de unixtime para contar à parte o que gravou.
const PASSO_UNIXTIME = 100_000;
const SENSORES = SENSORES_CARGA.length;

interface Estacao {
  vid: string;
  estacaoId: string;
  cliente: MqttClient;
  simulada: ReturnType<typeof gerarEstacoes>[number];
}

interface ResultadoDegrau {
  taxa: number;
  publicadas: number;
  confirmadas: number;
  erros: number;
  taxaEfetiva: number;
  puback: ReturnType<typeof resumirLatencias>;
  pontaAPonta: ReturnType<typeof resumirLatencias>;
  amostras: number;
  amostrasSemMedida: number;
  brutas?: number;
  medidas?: number;
}

/** Acompanha as mensagens amostradas até a medida aparecer no banco. */
class Sonda {
  private readonly pendentes = new Map<string, { estacaoId: string; unixtime: number; inicio: number }>();
  readonly latencias: number[] = [];
  private ativa = true;
  private laco?: Promise<void>;

  constructor(private readonly banco: Client) {}

  iniciar(): void {
    this.laco = (async () => {
      while (this.ativa || this.pendentes.size > 0) {
        await this.sondar();
        await dormir(INTERVALO_SONDAGEM_MS);
      }
    })();
  }

  acompanhar(estacaoId: string, unixtime: number, inicio: number): void {
    this.pendentes.set(`${estacaoId}|${unixtime}`, { estacaoId, unixtime, inicio });
  }

  /** Espera as pendentes até o prazo; devolve quantas nunca viraram medida. */
  async encerrar(prazoMs: number): Promise<number> {
    const limite = Date.now() + prazoMs;
    while (this.pendentes.size > 0 && Date.now() < limite) await dormir(100);
    const restantes = this.pendentes.size;
    this.pendentes.clear();
    this.ativa = false;
    await this.laco;
    return restantes;
  }

  private async sondar(): Promise<void> {
    if (this.pendentes.size === 0) return;
    const itens = [...this.pendentes.values()];
    const { rows } = await this.banco.query<{ estacaoId: string; unixtime: string }>(
      `SELECT DISTINCT m."estacaoId", m.unixtime
       FROM unnest($1::text[], $2::bigint[]) AS p(estacao, unixtime)
       JOIN medidas m ON m."estacaoId" = p.estacao AND m.unixtime = p.unixtime`,
      [itens.map((item) => item.estacaoId), itens.map((item) => item.unixtime)],
    );
    const agora = performance.now();
    for (const linha of rows) {
      const chave = `${linha.estacaoId}|${linha.unixtime}`;
      const item = this.pendentes.get(chave);
      if (!item) continue;
      this.latencias.push(agora - item.inicio);
      this.pendentes.delete(chave);
    }
  }
}

async function executarDegrau(indice: number, taxa: number, estacoes: Estacao[], base: number, banco: Client): Promise<ResultadoDegrau> {
  const inicioFaixa = base + indice * PASSO_UNIXTIME;
  const sequencias = new Int32Array(estacoes.length);
  const pubacks: number[] = [];
  const pendentes = new Set<Promise<void>>();
  const sonda = new Sonda(banco);
  sonda.iniciar();
  let publicadas = 0;
  let confirmadas = 0;
  let erros = 0;
  let proxima = 0;

  const publicar = () => {
    const posicao = proxima++ % estacoes.length;
    const estacao = estacoes[posicao];
    const sequencia = ++sequencias[posicao];
    if (sequencia >= PASSO_UNIXTIME) throw new Error('Faixa de unixtime do degrau esgotada: aumente NUM_ESTACOES.');
    const unixtime = inicioFaixa + sequencia;
    const corpo = JSON.stringify({ unixtime, leituras: gerarPayload(estacao.simulada) });
    const inicio = performance.now();
    publicadas++;
    if (publicadas % AMOSTRA === 0) sonda.acompanhar(estacao.estacaoId, unixtime, inicio);
    const envio: Promise<void> = estacao.cliente
      .publishAsync(topicoTelemetria(estacao.vid), corpo, { qos: 1 })
      .then(() => {
        confirmadas++;
        pubacks.push(performance.now() - inicio);
      })
      .catch(() => {
        erros++;
      })
      .finally(() => pendentes.delete(envio));
    pendentes.add(envio);
  };

  const inicio = performance.now();
  for (;;) {
    const decorrido = performance.now() - inicio;
    if (decorrido >= DURACAO_POR_TAXA * 1000) break;
    const devidas = Math.floor((decorrido * taxa) / 1000) - publicadas;
    for (let i = 0; i < devidas; i++) publicar();
    await dormir(2);
  }
  const duracaoReal = (performance.now() - inicio) / 1000;
  await Promise.allSettled(pendentes);
  const amostrasSemMedida = await sonda.encerrar(30_000);

  return {
    taxa,
    publicadas,
    confirmadas,
    erros,
    taxaEfetiva: publicadas / duracaoReal,
    puback: resumirLatencias(pubacks),
    pontaAPonta: resumirLatencias(sonda.latencias),
    amostras: sonda.latencias.length + amostrasSemMedida,
    amostrasSemMedida,
  };
}

async function contarGravado(banco: Client, prefixo: string, de: number): Promise<{ brutas: number; medidas: number }> {
  const ate = de + PASSO_UNIXTIME - 1;
  const { rows } = await banco.query<{ brutas: number; medidas: number }>(
    `SELECT
       (SELECT count(*)::int FROM leituras_brutas WHERE "vidEstacao" LIKE $1 AND "unixtimeDispositivo" BETWEEN $2 AND $3) AS brutas,
       (SELECT count(*)::int FROM medidas m JOIN estacoes e ON e.id = m."estacaoId"
         WHERE e.vid LIKE $1 AND m.unixtime BETWEEN $2 AND $3) AS medidas`,
    [`${prefixo}%`, de, ate],
  );
  return rows[0];
}

function tabela(resultados: ResultadoDegrau[]): string {
  const linhas = resultados.map((r) => {
    const perda = r.publicadas - (r.brutas ?? 0);
    return (
      `| ${r.taxa} | ${r.taxaEfetiva.toFixed(0)} | ${r.puback.p95.toFixed(0)} | ${r.pontaAPonta.p50.toFixed(0)} | ` +
      `${r.pontaAPonta.p95.toFixed(0)} | ${r.pontaAPonta.p99.toFixed(0)} | ${r.pontaAPonta.max.toFixed(0)} | ` +
      `${r.publicadas} | ${r.brutas ?? 0} | ${(r.medidas ?? 0) / SENSORES} | ${perda} |`
    );
  });
  return [
    '| Taxa alvo (msg/s) | Taxa efetiva | PUBACK p95 (ms) | Ponta a ponta p50 (ms) | p95 (ms) | p99 (ms) | máx (ms) | Publicadas | leituras_brutas | Leituras com medidas | Perda |',
    '| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |',
    ...linhas,
  ].join('\n');
}

async function main(): Promise<void> {
  const urlBanco = process.env.DATABASE_URL ?? '';
  if (!new URL(urlBanco).pathname.includes('carga')) {
    throw new Error('DATABASE_URL precisa apontar para um banco de carga (nome com "carga").');
  }
  const banco = new Client({ connectionString: urlBanco });
  await banco.connect();
  const broker = configBrokerDoAmbiente();

  const prefixo = `CARGA-MQTT-${Date.now().toString(36).toUpperCase()}-`;
  console.log(`Preparando ${NUM_ESTACOES} estações (${prefixo}…) no banco e no broker...`);
  const vids = await prepararCenarioMqtt(banco, broker, prefixo, NUM_ESTACOES);
  const { rows: ids } = await banco.query<{ id: string; vid: string }>('SELECT id, vid FROM estacoes WHERE vid LIKE $1', [`${prefixo}%`]);
  const idPorVid = new Map(ids.map((linha) => [linha.vid, linha.id]));

  console.log('Conectando as estações ao broker...');
  const simuladas = gerarEstacoes(NUM_ESTACOES);
  const estacoes: Estacao[] = [];
  for (let i = 0; i < vids.length; i += 100) {
    estacoes.push(
      ...(await Promise.all(
        vids.slice(i, i + 100).map(async (vid, j) => ({
          vid,
          estacaoId: idPorVid.get(vid)!,
          simulada: simuladas[i + j],
          cliente: await connectAsync(broker.url, {
            username: vid,
            password: chaveDaEstacaoDeCarga(vid),
            clientId: `carga-${vid}`,
            reconnectPeriod: 0,
          }),
        })),
      )),
    );
  }

  console.log(
    `Ambiente: Node ${process.version}, ${cpus().length}× ${cpus()[0].model.trim()}, ` +
      `${(totalmem() / 1024 ** 3).toFixed(1)} GB de RAM. Broker: ${broker.url}. ` +
      `Degraus: ${TAXAS.join(', ')} msg/s, ${DURACAO_POR_TAXA}s cada, ${NUM_ESTACOES} estações, ` +
      `amostra de 1 a cada ${AMOSTRA} mensagens.\n`,
  );

  // Base no passado (o unixtime não pode passar de "agora + 5 min").
  const base = Math.floor(Date.now() / 1000) - (TAXAS.length + 2) * PASSO_UNIXTIME;
  await executarDegrau(TAXAS.length + 1, 20, estacoes, base, banco); // aquecimento, fora da medição

  const resultados: ResultadoDegrau[] = [];
  for (const [indice, taxa] of TAXAS.entries()) {
    const resultado = await executarDegrau(indice, taxa, estacoes, base, banco);
    resultados.push(resultado);
    console.log(
      `[${taxa} msg/s] efetiva ${resultado.taxaEfetiva.toFixed(0)}/s | PUBACK p95 ${resultado.puback.p95.toFixed(0)} ms | ` +
        `ponta a ponta p50 ${resultado.pontaAPonta.p50.toFixed(0)} / p95 ${resultado.pontaAPonta.p95.toFixed(0)} / ` +
        `máx ${resultado.pontaAPonta.max.toFixed(0)} ms (${resultado.amostras} amostras, ${resultado.amostrasSemMedida} sem medida) | ` +
        `confirmadas ${resultado.confirmadas}/${resultado.publicadas} | erros ${resultado.erros}`,
    );
  }

  console.log('\nAguardando a ingestão e o tratamento terminarem...');
  let anterior = -1;
  for (let tentativa = 0; tentativa < 120; tentativa++) {
    let total = 0;
    for (let i = 0; i < resultados.length; i++) total += (await contarGravado(banco, prefixo, base + i * PASSO_UNIXTIME)).medidas;
    const esperado = resultados.reduce((soma, r) => soma + r.publicadas * SENSORES, 0);
    if (total >= esperado || (total === anterior && tentativa > 10)) break;
    anterior = total;
    await dormir(1000);
  }
  for (const [indice, resultado] of resultados.entries()) {
    Object.assign(resultado, await contarGravado(banco, prefixo, base + indice * PASSO_UNIXTIME));
  }

  console.log(`\n${tabela(resultados)}\n`);
  const sustentaveis = resultados.filter(
    (r) =>
      r.pontaAPonta.p95 <= LIMITE_P95_MS &&
      r.erros === 0 &&
      r.amostrasSemMedida === 0 &&
      r.confirmadas === r.publicadas &&
      r.brutas === r.publicadas &&
      r.medidas === r.publicadas * SENSORES &&
      r.taxaEfetiva >= r.taxa * 0.95,
  );
  const pico = sustentaveis.at(-1);
  console.log(
    pico
      ? `Maior degrau sustentado (ponta a ponta p95 ≤ ${LIMITE_P95_MS} ms, sem erros nem perda): ${pico.taxa} msg/s.`
      : `Nenhum degrau sustentou p95 ≤ ${LIMITE_P95_MS} ms sem erros nem perda.`,
  );

  await Promise.all(estacoes.map((estacao) => estacao.cliente.endAsync()));
  await banco.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
