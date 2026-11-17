import { cenarioPorIntervalo } from '../../../teste-carga/lib/cenario-intervalo';

describe('cenário por intervalo de envio (RNF20.2)', () => {
  it('a taxa da frota é estações / intervalo, e a medição dura os ciclos pedidos', () => {
    expect(cenarioPorIntervalo(1000, 300)).toEqual({ taxa: 1000 / 300, duracaoS: 300 });
    expect(cenarioPorIntervalo(60000, 300, 2)).toEqual({ taxa: 200, duracaoS: 600 });
  });

  it('recusa parâmetros inválidos', () => {
    expect(() => cenarioPorIntervalo(0, 300)).toThrow('NUM_ESTACOES');
    expect(() => cenarioPorIntervalo(10, 0)).toThrow('INTERVALO_ENVIO_S');
    expect(() => cenarioPorIntervalo(10, 300, 0)).toThrow('CICLOS');
  });
});
