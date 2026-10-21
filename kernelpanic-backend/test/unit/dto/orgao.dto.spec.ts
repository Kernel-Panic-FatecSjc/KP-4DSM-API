import { validate } from 'class-validator';
import { CriarOrgaoDto } from '../../../src/orgaos/dto/criar-orgao.dto';
import { AtualizarOrgaoDto } from '../../../src/orgaos/dto/atualizar-orgao.dto';

describe('DTOs de órgão', () => {
  const valido = {
    nome: 'Prefeitura',
    cnpj: '11.222.333/0001-81',
    esfera: 'MUNICIPAL',
    municipio: 'São Paulo',
    uf: 'SP',
  };

  it('aceita CNPJ válido formatado', async () => {
    expect(
      await validate(Object.assign(new CriarOrgaoDto(), valido)),
    ).toHaveLength(0);
  });

  it.each([
    '123',
    '11.222.333/0001-80',
    '00.000.000/0000-00',
    'abc11.222.333/0001-81',
  ])('rejeita CNPJ inválido: %s', async (cnpj) => {
    const errors = await validate(
      Object.assign(new CriarOrgaoDto(), { ...valido, cnpj }),
    );
    expect(errors.map(({ property }) => property)).toContain('cnpj');
  });

  it('valida também o CNPJ opcional quando ele é informado na edição', async () => {
    const errors = await validate(
      Object.assign(new AtualizarOrgaoDto(), { cnpj: 'cnpj-inválido' }),
    );
    expect(errors.map(({ property }) => property)).toContain('cnpj');
  });
});
