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
