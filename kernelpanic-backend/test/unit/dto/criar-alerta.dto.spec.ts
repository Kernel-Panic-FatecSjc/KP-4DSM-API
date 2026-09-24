import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { CriarAlertaDto } from '../../../src/alertas/dto/criar-alerta.dto';
import { NOVO_ALERTA } from '../../fixtures';

const validar = (payload: unknown) =>
  validateSync(plainToInstance(CriarAlertaDto, payload), { whitelist: true });

const camposComErro = (payload: unknown) => validar(payload).map((erro) => erro.property);

describe('CriarAlertaDto', () => {
  it('aceita uma regra completa com parâmetro, limiar e severidade', () => {
    expect(validar(NOVO_ALERTA)).toHaveLength(0);
  });

  it('aceita limiar negativo ou decimal', () => {
    expect(validar({ ...NOVO_ALERTA, valorLimite: -5.5 })).toHaveLength(0);
  });

  it('rejeita regra sem nenhum dos campos obrigatórios', () => {
    expect(camposComErro({})).toEqual(
      expect.arrayContaining(['operador', 'valorLimite', 'severidade', 'parametroId']),
    );
  });

  it('rejeita parâmetro monitorado que não seja UUID', () => {
    expect(camposComErro({ ...NOVO_ALERTA, parametroId: 'chuva' })).toEqual(['parametroId']);
  });

  it('rejeita limiar não numérico, NaN ou infinito', () => {
    expect(camposComErro({ ...NOVO_ALERTA, valorLimite: '30' })).toEqual(['valorLimite']);
    expect(camposComErro({ ...NOVO_ALERTA, valorLimite: Number.NaN })).toEqual(['valorLimite']);
    expect(camposComErro({ ...NOVO_ALERTA, valorLimite: Infinity })).toEqual(['valorLimite']);
  });

  it('rejeita severidade ou operador fora dos valores permitidos', () => {
    expect(camposComErro({ ...NOVO_ALERTA, severidade: 'CRITICA' })).toEqual(['severidade']);
    expect(camposComErro({ ...NOVO_ALERTA, operador: '>' })).toEqual(['operador']);
  });
});
