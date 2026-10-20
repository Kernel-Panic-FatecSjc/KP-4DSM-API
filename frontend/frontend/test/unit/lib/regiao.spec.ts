import { describe, expect, it } from 'vitest';
import { CAPITAIS_POR_UF, queryRegiao, regiaoDaUf } from '@/lib/regiao';

describe('regiaoDaUf', () => {
  it('usa as coordenadas da capital do estado', () => {
    expect(regiaoDaUf('SP')).toEqual({
      latitude: -23.5505,
      longitude: -46.6333,
      descricao: 'São Paulo (SP)',
    });
  });

  it('devolve null para uma UF inexistente', () => {
    expect(regiaoDaUf('XX')).toBeNull();
    expect(regiaoDaUf('sp')).toBeNull();
  });

  it('cobre os 26 estados e o Distrito Federal', () => {
    expect(Object.keys(CAPITAIS_POR_UF)).toHaveLength(27);
  });
});

describe('queryRegiao', () => {
  it('fica vazia sem região, para a API não filtrar', () => {
    expect(queryRegiao(null)).toBe('');
  });

  it('monta latitude e longitude como parâmetros de query', () => {
    const regiao = { latitude: -23.1896, longitude: -45.8841, descricao: 'sua localização' };

    expect(queryRegiao(regiao)).toBe('latitude=-23.1896&longitude=-45.8841');
  });
});
