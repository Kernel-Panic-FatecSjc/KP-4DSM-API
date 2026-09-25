import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { ListarLeiturasBrutasQueryDto } from '../../../src/leituras-brutas/dto/listar-leituras-brutas-query.dto';

function validar(payload: unknown) {
  return validateSync(plainToInstance(ListarLeiturasBrutasQueryDto, payload), { whitelist: true });
}

describe('ListarLeiturasBrutasQueryDto', () => {
  it('aceita filtro por VID e nome do campo do payload', () => {
    expect(validar({ vidEstacao: 'AA:BB:CC', campo: 'temperatura' })).toHaveLength(0);
  });

  it('rejeita filtros de texto acima do limite', () => {
    const erros = validar({ vidEstacao: 'v'.repeat(65), campo: 'p'.repeat(101) });

    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['vidEstacao', 'campo']));
  });

  it('rejeita filtros que não sejam texto', () => {
    const erros = validar({ vidEstacao: ['VID'], campo: { nome: 'chuva' } });

    expect(erros.map((erro) => erro.property)).toEqual(expect.arrayContaining(['vidEstacao', 'campo']));
  });
});