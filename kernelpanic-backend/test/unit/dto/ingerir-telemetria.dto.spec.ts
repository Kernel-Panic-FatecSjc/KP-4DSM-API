import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { IngerirTelemetriaDto } from '../../../src/ingestao/dto/ingerir-telemetria.dto';
import { MAXIMO_SENSORES_POR_LEITURA } from '../../../src/ingestao/mapa-leituras.validator';
import { LEITURAS, VID_ESTACAO } from '../../fixtures';

const validar = (payload: unknown) =>
  validateSync(plainToInstance(IngerirTelemetriaDto, payload), { whitelist: true });

describe('IngerirTelemetriaDto', () => {
  it('aceita o payload que o firmware envia', () => {
    expect(
      validar({
        vid: VID_ESTACAO,
        unixtime: 1_760_000_000,
        latitude: -23.1,
        longitude: -45.8,
        leituras: LEITURAS,
      }),
    ).toHaveLength(0);
  });

  it('aceita payload mínimo, só com vid e leituras', () => {
    expect(validar({ vid: VID_ESTACAO, leituras: LEITURAS })).toHaveLength(0);
  });

  it('rejeita payload sem vid', () => {
    expect(validar({ leituras: LEITURAS })).not.toHaveLength(0);
  });

  it('rejeita leituras vazias, em array ou com valor não numérico', () => {
    expect(validar({ vid: VID_ESTACAO, leituras: {} })).not.toHaveLength(0);
    expect(validar({ vid: VID_ESTACAO, leituras: [1, 2] })).not.toHaveLength(0);
    expect(validar({ vid: VID_ESTACAO, leituras: { chuvaMm: 'muita' } })).not.toHaveLength(0);
    expect(validar({ vid: VID_ESTACAO, leituras: { chuvaMm: null } })).not.toHaveLength(0);
  });

  it('rejeita nome de sensor fora do padrão do firmware', () => {
    expect(validar({ vid: VID_ESTACAO, leituras: { 'chuva-mm': 1 } })).not.toHaveLength(0);
    expect(validar({ vid: VID_ESTACAO, leituras: { '2chuva': 1 } })).not.toHaveLength(0);
  });

  it('rejeita mais sensores do que o teto por leitura', () => {
    const leituras = Object.fromEntries(
      Array.from({ length: MAXIMO_SENSORES_POR_LEITURA + 1 }, (_, i) => [`sensor${i}`, 1]),
    );
    expect(validar({ vid: VID_ESTACAO, leituras })).not.toHaveLength(0);
  });

  it('rejeita coordenadas fora de faixa', () => {
    expect(validar({ vid: VID_ESTACAO, latitude: 120, leituras: LEITURAS })).not.toHaveLength(0);
    expect(validar({ vid: VID_ESTACAO, longitude: -400, leituras: LEITURAS })).not.toHaveLength(0);
  });

  it('rejeita unixtime zerado ou no futuro distante', () => {
    expect(validar({ vid: VID_ESTACAO, unixtime: 0, leituras: LEITURAS })).not.toHaveLength(0);
    expect(
      validar({
        vid: VID_ESTACAO,
        unixtime: Math.floor(Date.now() / 1000) + 86_400,
        leituras: LEITURAS,
      }),
    ).not.toHaveLength(0);
  });
});
