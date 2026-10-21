import { describe, expect, it } from 'vitest';
import { formatarFaixa, lerFaixa } from '@/lib/faixa-sensor';

describe('lerFaixa', () => {
  it('deixa em branco como limite sem checagem', () => {
    expect(lerFaixa('', '')).toEqual({ minimo: null, maximo: null });
    expect(lerFaixa('  ', '100')).toEqual({ minimo: null, maximo: 100 });
  });

  it('aceita vírgula decimal e valores negativos', () => {
    expect(lerFaixa('-40,5', '60')).toEqual({ minimo: -40.5, maximo: 60 });
  });

  it('aceita mínimo igual ao máximo (limites inclusivos)', () => {
    expect(lerFaixa('5', '5')).toEqual({ minimo: 5, maximo: 5 });
  });

  it('recusa mínimo maior que o máximo', () => {
    expect(lerFaixa('10', '9')).toEqual({ erro: 'O valor mínimo não pode ser maior que o máximo.' });
  });

  it('recusa limite que não é número', () => {
    expect(lerFaixa('abc', '')).toHaveProperty('erro');
    expect(lerFaixa('', 'Infinity')).toHaveProperty('erro');
  });
});

describe('formatarFaixa', () => {
  it('descreve faixa completa, com um limite só ou sem faixa', () => {
    expect(formatarFaixa(0, 500)).toBe('0 a 500');
    expect(formatarFaixa(0, null)).toBe('a partir de 0');
    expect(formatarFaixa(null, 100)).toBe('até 100');
    expect(formatarFaixa(null, null)).toBe('Sem faixa');
    expect(formatarFaixa(undefined, undefined)).toBe('Sem faixa');
  });
});
