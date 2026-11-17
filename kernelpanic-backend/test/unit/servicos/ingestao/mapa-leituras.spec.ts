import {
  MAXIMO_SENSORES_POR_LEITURA,
  ehMapaDeLeituras,
} from '../../../../servicos/ingestao/validacao/mapa-leituras.validator';

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

  it('aceita os nomes que o cadastro de sensores aceita (acento, espaço, hífen, até 120 caracteres)', () => {
    expect(ehMapaDeLeituras({ Pluviômetro: 1, 'Chuva acumulada': 2, 'chuva-mm': 3 })).toBe(true);
    expect(ehMapaDeLeituras({ ['a'.repeat(120)]: 1 })).toBe(true);
  });

  it('recusa nomes de sensor fora do padrão', () => {
    expect(ehMapaDeLeituras({ '': 1 })).toBe(false);
    expect(ehMapaDeLeituras({ ' temperatura': 1 })).toBe(false);
    expect(ehMapaDeLeituras({ 'temperatura ': 1 })).toBe(false);
    expect(ehMapaDeLeituras({ 'tempe\nratura': 1 })).toBe(false);
    expect(ehMapaDeLeituras({ ['a'.repeat(121)]: 1 })).toBe(false);
    expect(ehMapaDeLeituras(JSON.parse('{"__proto__": 1}'))).toBe(false);
    expect(ehMapaDeLeituras({ constructor: 1 })).toBe(false);
  });

  it('recusa mais sensores que o teto', () => {
    const excedente = Object.fromEntries(
      Array.from({ length: MAXIMO_SENSORES_POR_LEITURA + 1 }, (_, i) => [`sensor${i}`, 1]),
    );
    expect(ehMapaDeLeituras(excedente)).toBe(false);
  });
});
