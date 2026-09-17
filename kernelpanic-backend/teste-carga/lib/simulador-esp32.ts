/** Qualquer coisa que saiba rodar uma query — serve tanto para `Client` quanto para `Pool`. */
export interface Executor {
  query(text: string, values?: unknown[]): Promise<unknown>;
}

// Bounding box aproximado da região Vale do Paraíba / Serra da Mantiqueira (SP),
// só para os pontos terem uma dispersão geográfica plausível.
const LAT_MIN = -23.5;
const LAT_MAX = -22.0;
const LNG_MIN = -46.5;
const LNG_MAX = -44.5;

export interface EstacaoSimulada {
  vid: string;
  lat: number;
  lng: number;
  baseTemperatura: number;
  baseUmidade: number;
  basePressao: number;
}

export interface Leitura {
  estacao: EstacaoSimulada;
  payload: Record<string, number>;
}

export function aleatorioEntre(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

export function gerarEstacoes(qtd: number): EstacaoSimulada[] {
  const estacoes: EstacaoSimulada[] = [];
  for (let i = 1; i <= qtd; i++) {
    estacoes.push({
      vid: `ESP32-${String(i).padStart(5, '0')}`,
      lat: aleatorioEntre(LAT_MIN, LAT_MAX),
      lng: aleatorioEntre(LNG_MIN, LNG_MAX),
      baseTemperatura: aleatorioEntre(18, 30),
      baseUmidade: aleatorioEntre(40, 85),
      basePressao: aleatorioEntre(1005, 1020),
    });
  }
  return estacoes;
}

export function embaralhar<T>(itens: T[]): T[] {
  const copia = [...itens];
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copia[i], copia[j]] = [copia[j], copia[i]];
  }
  return copia;
}

export function gerarPayload(estacao: EstacaoSimulada): Record<string, number> {
  return {
    temperatura: Number((estacao.baseTemperatura + aleatorioEntre(-0.5, 0.5)).toFixed(1)),
    umidade: Number((estacao.baseUmidade + aleatorioEntre(-2, 2)).toFixed(1)),
    pressao: Number((estacao.basePressao + aleatorioEntre(-0.3, 0.3)).toFixed(1)),
    chuvaMm: Number(Math.max(0, aleatorioEntre(-1, 1)).toFixed(2)),
    ventoVelocidadeKmh: Number(aleatorioEntre(0, 25).toFixed(1)),
    ventoDirecaoGraus: Math.round(aleatorioEntre(0, 359)),
  };
}

export function dormir(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

const PARAMS_POR_LINHA = 5;
// Postgres aceita no máximo 65535 parâmetros por query; 10000 linhas fica com
// folga desse teto e ainda é um INSERT multi-linha só (sem virar N round-trips).
const MAX_LINHAS_POR_QUERY = 10_000;

async function inserirSubLote(executor: Executor, leituras: Leitura[]): Promise<void> {
  const valores: unknown[] = [];
  const linhas = leituras.map((leitura, indice) => {
    const base = indice * PARAMS_POR_LINHA;
    valores.push(
      leitura.estacao.vid,
      JSON.stringify(leitura.payload),
      leitura.estacao.lng,
      leitura.estacao.lat,
      Math.floor(Date.now() / 1000),
    );
    return `(gen_random_uuid(), $${base + 1}, $${base + 2}::jsonb, ST_SetSRID(ST_MakePoint($${base + 3}, $${base + 4}), 4326), $${base + 5})`;
  });

  await executor.query(
    `INSERT INTO leituras_brutas (id, "vidEstacao", payload, localizacao, "unixtimeDispositivo")
     VALUES ${linhas.join(', ')}`,
    valores,
  );
}

/**
 * Insere um lote de leituras brutas. Acima de MAX_LINHAS_POR_QUERY, quebra em
 * vários INSERTs multi-linha sequenciais para não estourar o limite de
 * parâmetros por query do Postgres (65535). Aceita um `Client` (uma conexão)
 * ou um `Pool` (o pg tira uma conexão livre a cada chamada de `.query`).
 */
export async function inserirLote(executor: Executor, leituras: Leitura[]): Promise<void> {
  for (let i = 0; i < leituras.length; i += MAX_LINHAS_POR_QUERY) {
    await inserirSubLote(executor, leituras.slice(i, i + MAX_LINHAS_POR_QUERY));
  }
}
