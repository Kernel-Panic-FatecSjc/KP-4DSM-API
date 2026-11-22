import { percentil, resumirLatencias } from '../../../teste-carga/lib/estatisticas';

describe('estatísticas do teste de carga', () => {
  const de1a100 = Array.from({ length: 100 }, (_, i) => i + 1);

  it('percentil devolve o valor do posto correspondente', () => {
    expect(percentil(de1a100, 50)).toBe(50);
    expect(percentil(de1a100, 95)).toBe(95);
    expect(percentil(de1a100, 99)).toBe(99);
    expect(percentil(de1a100, 100)).toBe(100);
  });

  it('percentil de uma amostra só e de nenhuma amostra', () => {
    expect(percentil([7], 95)).toBe(7);
    expect(percentil([], 95)).toBe(0);
  });

  it('resumirLatencias ordena antes de calcular e informa o máximo', () => {
    const embaralhadas = [...de1a100].reverse();
    expect(resumirLatencias(embaralhadas)).toEqual({ p50: 50, p95: 95, p99: 99, max: 100 });
    expect(resumirLatencias([])).toEqual({ p50: 0, p95: 0, p99: 0, max: 0 });
  });

  it('com poucas amostras o p95 cai na última, e uma lenta aparece nele', () => {
    expect(resumirLatencias([10, 12, 11, 5000]).p95).toBe(5000);
  });
});
