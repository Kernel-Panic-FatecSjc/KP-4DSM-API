import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { AtualizarSensorDto } from '../../../src/sensores/dto/atualizar-sensor.dto';
import { CriarSensorDto } from '../../../src/sensores/dto/criar-sensor.dto';

const NOVO_SENSOR = { nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2 };

const camposComErro = (dto: typeof CriarSensorDto | typeof AtualizarSensorDto, payload: unknown) =>
  validateSync(plainToInstance(dto, payload), { whitelist: true }).map((erro) => erro.property);

describe('CriarSensorDto', () => {
  it('aceita um sensor completo com unidade do catálogo', () => {
    expect(camposComErro(CriarSensorDto, NOVO_SENSOR)).toHaveLength(0);
  });

  it('rejeita sensor sem nenhum dos campos obrigatórios', () => {
    expect(camposComErro(CriarSensorDto, {})).toEqual(
      expect.arrayContaining(['nome', 'unidade', 'fator', 'ganho']),
    );
  });

  it('apara o nome e rejeita nome só com espaços', () => {
    const dto = plainToInstance(CriarSensorDto, { ...NOVO_SENSOR, nome: '  Pluviômetro  ' });
    expect(dto.nome).toBe('Pluviômetro');
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, nome: '   ' })).toEqual(['nome']);
  });

  it('rejeita unidade fora do catálogo', () => {
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, unidade: 'polegadas' })).toEqual(['unidade']);
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, unidade: 'MM' })).toEqual(['unidade']);
  });

  it('rejeita fator zero, que anularia as leituras', () => {
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, fator: 0 })).toEqual(['fator']);
  });

  it('aceita fator e ganho negativos ou decimais', () => {
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, fator: -0.5, ganho: -32 })).toHaveLength(0);
  });

  it('aceita a faixa física opcional, inclusive um limite só e valores negativos', () => {
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, valorMinimo: -40, valorMaximo: 60 })).toHaveLength(0);
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, valorMinimo: 0 })).toHaveLength(0);
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, valorMaximo: 100 })).toHaveLength(0);
  });

  it('rejeita limite da faixa não numérico, NaN ou infinito', () => {
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, valorMinimo: '0' })).toEqual(['valorMinimo']);
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, valorMaximo: Number.NaN })).toEqual(['valorMaximo']);
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, valorMaximo: Infinity })).toEqual(['valorMaximo']);
  });

  it('rejeita fator ou ganho não numérico, NaN ou infinito', () => {
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, fator: '1' })).toEqual(['fator']);
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, ganho: Number.NaN })).toEqual(['ganho']);
    expect(camposComErro(CriarSensorDto, { ...NOVO_SENSOR, ganho: Infinity })).toEqual(['ganho']);
  });
});

describe('AtualizarSensorDto', () => {
  it('aceita atualização parcial', () => {
    expect(camposComErro(AtualizarSensorDto, {})).toHaveLength(0);
    expect(camposComErro(AtualizarSensorDto, { ganho: 0.5 })).toHaveLength(0);
  });

  it('aplica as mesmas regras aos campos enviados', () => {
    expect(camposComErro(AtualizarSensorDto, { nome: '  ' })).toEqual(['nome']);
    expect(camposComErro(AtualizarSensorDto, { unidade: 'xyz' })).toEqual(['unidade']);
    expect(camposComErro(AtualizarSensorDto, { fator: 0 })).toEqual(['fator']);
    expect(camposComErro(AtualizarSensorDto, { valorMaximo: 'alto' })).toEqual(['valorMaximo']);
  });

  it('aceita null para limpar um limite da faixa', () => {
    expect(camposComErro(AtualizarSensorDto, { valorMinimo: null, valorMaximo: null })).toHaveLength(0);
  });
});
