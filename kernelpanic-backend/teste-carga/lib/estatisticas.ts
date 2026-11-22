/** Percentil pelo método do posto mais próximo: o menor valor com pelo menos `p`% das amostras abaixo ou iguais a ele. */
export function percentil(ordenados: number[], p: number): number {
  if (ordenados.length === 0) return 0;
  const posicao = Math.ceil((p / 100) * ordenados.length) - 1;
  return ordenados[Math.min(ordenados.length - 1, Math.max(0, posicao))];
}

export interface ResumoLatencia {
  p50: number;
  p95: number;
  p99: number;
  max: number;
}

export function resumirLatencias(latenciasMs: number[]): ResumoLatencia {
  const ordenadas = [...latenciasMs].sort((a, b) => a - b);
  return {
    p50: percentil(ordenadas, 50),
    p95: percentil(ordenadas, 95),
    p99: percentil(ordenadas, 99),
    max: ordenadas[ordenadas.length - 1] ?? 0,
  };
}
