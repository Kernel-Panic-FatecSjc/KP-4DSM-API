import { motivoForaDaFaixa } from '../../../servicos/ingestao/validacao/faixa-fisica';

describe('motivoForaDaFaixa', () => {
  it('aceita valor dentro da faixa', () => {
    expect(motivoForaDaFaixa(25, -40, 60)).toBeNull();
  });

  it('aceita o valor igual a cada limite (limites inclusivos)', () => {
    expect(motivoForaDaFaixa(-40, -40, 60)).toBeNull();
    expect(motivoForaDaFaixa(60, -40, 60)).toBeNull();
  });

  it('recusa o que passa do limite por qualquer margem', () => {
    expect(motivoForaDaFaixa(-40.001, -40, 60)).toBe('ABAIXO_DO_MINIMO');
    expect(motivoForaDaFaixa(60.001, -40, 60)).toBe('ACIMA_DO_MAXIMO');
    expect(motivoForaDaFaixa(150, -40, 60)).toBe('ACIMA_DO_MAXIMO');
  });

  it('com um limite só, checa apenas aquele lado (pressão negativa, umidade acima de 100)', () => {
    expect(motivoForaDaFaixa(-1, 0, null)).toBe('ABAIXO_DO_MINIMO');
    expect(motivoForaDaFaixa(1_000_000, 0, null)).toBeNull();
    expect(motivoForaDaFaixa(100.5, null, 100)).toBe('ACIMA_DO_MAXIMO');
    expect(motivoForaDaFaixa(-1_000_000, null, 100)).toBeNull();
  });

  it('sem faixa configurada, não recusa nada', () => {
    expect(motivoForaDaFaixa(1e9)).toBeNull();
    expect(motivoForaDaFaixa(-1e9, null, null)).toBeNull();
  });

  it('trata o zero como limite de verdade, e não como "sem limite"', () => {
    expect(motivoForaDaFaixa(-0.1, 0, 10)).toBe('ABAIXO_DO_MINIMO');
    expect(motivoForaDaFaixa(0.1, -10, 0)).toBe('ACIMA_DO_MAXIMO');
  });
});
