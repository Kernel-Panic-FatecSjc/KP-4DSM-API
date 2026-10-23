import type {
  ContratoApi,
  ContratoPayload,
  ContratosPaginadosApi,
  OrgaoApi,
  StatusContratoApi,
} from '@/lib/api';
import { ADMIN, umUsuario } from './support/dados';
import { expect, logarComo, test } from './support/teste';

const ORGAO: OrgaoApi = {
  id: 'orgao-1',
  nome: 'Defesa Civil de São José dos Campos',
  cnpj: '12345678000195',
  esfera: 'MUNICIPAL',
  municipio: 'São José dos Campos',
  uf: 'SP',
  ativo: true,
  criadoEm: '2026-01-01T00:00:00.000Z',
  atualizadoEm: '2026-01-01T00:00:00.000Z',
};

function criarContrato(
  dados: Partial<ContratoApi> = {},
  status: StatusContratoApi = 'RASCUNHO',
): ContratoApi {
  return {
    id: 'contrato-1',
    numero: 'CTR-2026-001',
    objeto: 'Monitoramento pluviométrico municipal',
    inicioVigencia: '2026-11-01T00:00:00.000Z',
    fimVigencia: '2027-10-31T23:59:59.999Z',
    status,
    criadoEm: '2026-10-01T00:00:00.000Z',
    atualizadoEm: '2026-10-01T00:00:00.000Z',
    encerradoEm: null,
    orgao: { id: ORGAO.id, nome: ORGAO.nome, cnpj: ORGAO.cnpj },
    quantidadeEstacoes: 0,
    ...dados,
  };
}

test.describe('Contratos', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    let contratos = [criarContrato()];

    api.responder('GET /orgaos', { body: [ORGAO] });
    api.responder('GET /contratos', ({ url }) => {
      const busca = url.searchParams.get('busca')?.toLocaleLowerCase('pt-BR') ?? '';
      const status = url.searchParams.get('status');
      const orgaoId = url.searchParams.get('orgaoId');
      const encontrados = contratos.filter((contrato) =>
        (!busca ||
          contrato.numero.toLocaleLowerCase('pt-BR').includes(busca) ||
          contrato.objeto.toLocaleLowerCase('pt-BR').includes(busca) ||
          contrato.orgao.nome.toLocaleLowerCase('pt-BR').includes(busca)) &&
        (!status || contrato.status === status) &&
        (!orgaoId || contrato.orgao.id === orgaoId),
      );
      const pagina = Number(url.searchParams.get('pagina') ?? 1);
      const tamanho = Number(url.searchParams.get('tamanho') ?? 10);
      const resposta: ContratosPaginadosApi = {
        contratos: encontrados.slice((pagina - 1) * tamanho, pagina * tamanho),
        total: encontrados.length,
        pagina,
        tamanho,
      };
      return { body: resposta };
    });
    api.responder('POST /contratos', ({ corpo }) => {
      const dados = corpo as ContratoPayload;
      const criado = criarContrato({
        id: 'contrato-novo',
        ...dados,
        orgao: { id: ORGAO.id, nome: ORGAO.nome, cnpj: ORGAO.cnpj },
      }, dados.status);
      contratos = [criado, ...contratos];
      return { status: 201, body: criado };
    });
    api.responder('PATCH /contratos/:id', ({ params, corpo }) => {
      const dados = corpo as Partial<ContratoPayload>;
      contratos = contratos.map((contrato) =>
        contrato.id === params.id ? { ...contrato, ...dados } : contrato,
      );
      return { body: contratos.find((contrato) => contrato.id === params.id) };
    });
    api.responder('PATCH /contratos/:id/encerrar', ({ params }) => {
      contratos = contratos.map((contrato) =>
        contrato.id === params.id ? { ...contrato, status: 'ENCERRADO' } : contrato,
      );
      return { body: contratos.find((contrato) => contrato.id === params.id) };
    });

    await page.goto('/contratos');
    await expect(page.getByRole('row', { name: /CTR-2026-001/ })).toBeVisible();
  });

  test('mostra CNPJ do órgão, remove estações e filtra por status e órgão', async ({ page, api }) => {
    const linha = page.getByRole('row', { name: /CTR-2026-001/ });
    await expect(linha).toContainText('12.345.678/0001-95');

    await page.getByLabel('Status').selectOption('RASCUNHO');
    await page.getByLabel('Órgão').selectOption(ORGAO.id);
    await expect.poll(() => api.chamadasDe('GET /contratos').length).toBeGreaterThan(1);
    const chamada = api.chamadasDe('GET /contratos').at(-1);
    expect(chamada?.url.searchParams.get('status')).toBe('RASCUNHO');
    expect(chamada?.url.searchParams.get('orgaoId')).toBe(ORGAO.id);

    await page.getByRole('button', { name: 'Novo contrato' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cadastrar contrato' });
    await expect(dialogo.getByLabel('CNPJ')).toHaveCount(0);
    await expect(dialogo.getByText('Estações vinculadas')).toHaveCount(0);
    await expect(dialogo.getByLabel('Órgão público')).toBeVisible();
  });

  test('mostra cinco contratos por página e navega para a próxima página', async ({ page, api }) => {
    const contratos = Array.from({ length: 6 }, (_, indice) =>
      criarContrato({ id: `contrato-${indice + 1}`, numero: `CTR-2026-${String(indice + 1).padStart(3, '0')}` }),
    );
    api.responder('GET /contratos', ({ url }) => {
      const pagina = Number(url.searchParams.get('pagina') ?? 1);
      const tamanho = Number(url.searchParams.get('tamanho') ?? 10);
      return {
        body: {
          contratos: contratos.slice((pagina - 1) * tamanho, pagina * tamanho),
          total: contratos.length,
          pagina,
          tamanho,
        } satisfies ContratosPaginadosApi,
      };
    });

    await page.reload();
    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    await expect(page.getByRole('row', { name: /CTR-2026-/ })).toHaveCount(5);
    expect(api.chamadasDe('GET /contratos').at(-1)?.url.searchParams.get('tamanho')).toBe('5');

    await page.getByText('Página 1 de 2').locator('..').getByRole('button').last().click();
    await expect(page.getByText('Página 2 de 2')).toBeVisible();
    await expect(page.getByRole('row', { name: /CTR-2026-/ })).toHaveCount(1);
    expect(api.chamadasDe('GET /contratos').at(-1)?.url.searchParams.get('pagina')).toBe('2');
  });

  test('cadastra contrato com órgão e vigência e confirma mudança de status', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Novo contrato' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cadastrar contrato' });
    await dialogo.getByLabel('Número do contrato').fill('CTR-2026-002');
    await dialogo.getByLabel('Objeto').fill('Instalação de sensores');
    await dialogo.getByLabel('Órgão público').selectOption(ORGAO.id);
    await dialogo.getByLabel('Status').selectOption('VIGENTE');
    await dialogo.getByLabel('Início da vigência').fill('2026-11-01');
    await dialogo.getByLabel('Fim da vigência').fill('2027-10-31');
    await dialogo.getByRole('button', { name: 'Cadastrar contrato' }).click();
    const confirmacaoCadastro = page.getByRole('alertdialog', { name: 'Confirmar mudança de status?' });
    await expect(confirmacaoCadastro).toContainText('Vigente');
    expect(api.chamadasDe('POST /contratos')).toHaveLength(0);
    await confirmacaoCadastro.getByRole('button', { name: 'Confirmar' }).click();
    await expect(dialogo).toHaveCount(0);

    const criacao = api.chamadasDe('POST /contratos')[0];
    expect(criacao?.corpo).toMatchObject({
      numero: 'CTR-2026-002',
      objeto: 'Instalação de sensores',
      orgaoId: ORGAO.id,
      status: 'VIGENTE',
      inicioVigencia: '2026-11-01',
      fimVigencia: '2027-10-31',
    });

    await page.getByRole('row', { name: /CTR-2026-001/ }).getByRole('button', { name: 'Editar' }).click();
    const edicao = page.getByRole('dialog', { name: 'Editar contrato' });
    await edicao.getByLabel('Status').selectOption('VIGENTE');
    await edicao.getByRole('button', { name: 'Salvar alterações' }).click();

    const confirmacao = page.getByRole('alertdialog', { name: 'Confirmar mudança de status?' });
    await expect(confirmacao).toContainText('Vigente');
    expect(api.chamadasDe('PATCH /contratos/:id')).toHaveLength(0);
    await confirmacao.getByRole('button', { name: 'Confirmar' }).click();
    await expect(confirmacao).toHaveCount(0);
    expect(api.chamadasDe('PATCH /contratos/:id')).toHaveLength(1);
    expect(api.chamadasDe('PATCH /contratos/:id')[0]?.corpo).toMatchObject({ status: 'VIGENTE' });
  });

  test('confirma o encerramento e oculta o link de contratos para monitor', async ({ page, api }) => {
    await page.getByRole('row', { name: /CTR-2026-001/ }).getByRole('button', { name: 'Encerrar' }).click();
    const confirmacao = page.getByRole('alertdialog', { name: 'Confirmar mudança de status?' });
    await confirmacao.getByRole('button', { name: 'Confirmar' }).click();
    await expect(confirmacao).toHaveCount(0);
    expect(api.chamadasDe('PATCH /contratos/:id/encerrar')).toHaveLength(1);

    logarComo(api, umUsuario({ tipo: 'MONITOR' }));
    await page.reload();
    await expect(page.getByText('Esta página está disponível somente para administradores.', { exact: true })).toBeVisible();
    await expect(page.getByRole('link', { name: 'Contratos' })).toHaveCount(0);
    expect(api.chamadasDe('GET /contratos')).toHaveLength(2);
  });
});
