import { validateSync } from 'class-validator';
import { CriarOrgaoDto } from '../../../src/orgaos/dto/criar-orgao.dto';

function validarCnpj(cnpj: string): string[] {
  const dto = Object.assign(new CriarOrgaoDto(), {
    nome: 'Órgão de teste',
    cnpj,
    esfera: 'MUNICIPAL',
    municipio: 'São Paulo',
    uf: 'SP',
  });
  return validateSync(dto)
    .filter((erro) => erro.property === 'cnpj')
    .flatMap((erro) => Object.values(erro.constraints ?? {}));
}

describe('validador de CNPJ de órgãos', () => {
  it('aceita CNPJ alfanumérico válido', () => {
    expect(validarCnpj('12.ABC.345/01DE-35')).toEqual([]);
  });

  it('rejeita CNPJ alfanumérico com dígitos verificadores inválidos', () => {
    expect(validarCnpj('12.ABC.345/01DE-36')).toContain(
      'cnpj deve ser válido',
    );
  });
});
