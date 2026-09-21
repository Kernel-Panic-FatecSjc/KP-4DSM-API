import {
  MAXIMO_SENSORES_POR_LEITURA,
  ehMapaDeLeituras,
} from '../../../src/ingestao/mapa-leituras.validator';

describe('ehMapaDeLeituras', () => {
  it('aceita pares nomeDoSensor/valor', () => {
    expect(ehMapaDeLeituras({ temperatura: 24.3, chuvaMm: 0 })).toBe(true);
    expect(ehMapaDeLeituras({ ventoDirecaoGraus: -1.5 })).toBe(true);
  });

  it('recusa o que não é um objeto de leituras', () => {
    expect(ehMapaDeLeituras({})).toBe(false);
    expect(ehMapaDeLeituras([])).toBe(false);
    expect(ehMapaDeLeituras(null)).toBe(false);
    expect(ehMapaDeLeituras('temperatura=24')).toBe(false);
  });

  it('recusa valores que não são números finitos', () => {
    expect(ehMapaDeLeituras({ temperatura: '24' })).toBe(false);
    expect(ehMapaDeLeituras({ temperatura: NaN })).toBe(false);
    expect(ehMapaDeLeituras({ temperatura: Infinity })).toBe(false);
  });

  it('recusa nomes de sensor fora do padrão', () => {
    expect(ehMapaDeLeituras({ 'chuva-mm': 1 })).toBe(false);
    expect(ehMapaDeLeituras({ '': 1 })).toBe(false);
    expect(ehMapaDeLeituras({ ['a'.repeat(65)]: 1 })).toBe(false);
  });

  it('recusa mais sensores que o teto', () => {
    const excedente = Object.fromEntries(
      Array.from({ length: MAXIMO_SENSORES_POR_LEITURA + 1 }, (_, i) => [`sensor${i}`, 1]),
    );
    expect(ehMapaDeLeituras(excedente)).toBe(false);
  });
});
