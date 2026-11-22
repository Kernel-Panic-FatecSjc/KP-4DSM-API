import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { HistoricoClimaticoQueryDto } from '../../../src/relatorios/dto/historico-climatico-query.dto';

const ID_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const ID_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

function camposComErro(payload: unknown): string[] {
  return validateSync(plainToInstance(HistoricoClimaticoQueryDto, payload), {
    whitelist: true,
  }).map((erro) => erro.property);
}

describe('HistoricoClimaticoQueryDto', () => {
  it('aceita período, granularidade e lista de estações', () => {
    expect(
      camposComErro({
        de: '2026-01-01',
        ate: '2026-12-31',
        granularidade: 'dia',
        estacaoIds: [ID_A, ID_B],
      }),
    ).toHaveLength(0);
  });

  it('normaliza estacaoIds repetidos na query string e a sintaxe com colchetes', () => {
    const repetidos = plainToInstance(HistoricoClimaticoQueryDto, {
      de: '2026-01-01',
      ate: '2026-12-31',
      granularidade: 'hora',
      estacaoIds: ID_A,
    });
    expect(repetidos.estacaoIds).toEqual([ID_A]);

    const comColchetes = plainToInstance(HistoricoClimaticoQueryDto, {
      de: '2026-01-01',
      ate: '2026-12-31',
      granularidade: 'hora',
      'estacaoIds[]': [ID_A, ID_B],
    });
    expect(comColchetes.estacaoIdsComColchetes).toEqual([ID_A, ID_B]);
    expect(validateSync(comColchetes, { whitelist: true })).toHaveLength(0);
  });

  it('rejeita data, granularidade, UUID ou estação repetida inválidos', () => {
    expect(
      camposComErro({ de: 'ontem', ate: '2026-12-31', granularidade: 'dia' }),
    ).toEqual(expect.arrayContaining(['de']));
    expect(
      camposComErro({
        de: '2026-01-01',
        ate: '2026-12-31',
        granularidade: 'semana',
      }),
    ).toEqual(expect.arrayContaining(['granularidade']));
    expect(
      camposComErro({
        de: '2026-01-01',
        ate: '2026-12-31',
        granularidade: 'dia',
        estacaoIds: [ID_A, ID_A],
      }),
    ).toEqual(expect.arrayContaining(['estacaoIds']));
    expect(
      camposComErro({
        de: '2026-01-01',
        ate: '2026-12-31',
        granularidade: 'dia',
        estacaoIds: ['ruim'],
      }),
    ).toEqual(expect.arrayContaining(['estacaoIds']));
    expect(
      camposComErro({
        de: '2026-02-31',
        ate: '2026-12-31',
        granularidade: 'dia',
      }),
    ).toEqual(expect.arrayContaining(['de']));
  });
});
