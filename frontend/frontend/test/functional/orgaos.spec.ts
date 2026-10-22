import type { Page } from '@playwright/test';
import type { OrgaoApi } from '@/lib/api';
import { gerarCnpj } from '@/lib/cnpj';
import { ADMIN } from './support/dados';
import { expect, logarComo, test } from './support/teste';

function criarOrgao(
  id: string,
  nome: string,
  cnpj: string,
  ativo: boolean,
  municipio: string,
  esfera: OrgaoApi['esfera'] = 'MUNICIPAL',
): OrgaoApi {
  return {
    id,
    nome,
    cnpj,
    esfera,
    municipio,
    uf: 'SP',
    ativo,
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
  };
}

const ORGAOS_INICIAIS: OrgaoApi[] = [
  criarOrgao('orgao-1', 'Defesa Civil de São José dos Campos', gerarCnpj('123456780001'), true, 'São José dos Campos'),
  criarOrgao('orgao-2', 'Prefeitura Municipal de Jacareí', gerarCnpj('234567890001'), true, 'Jacareí'),
  criarOrgao('orgao-3', 'Coordenadoria Estadual de Proteção e Defesa Civil', gerarCnpj('345678900001'), false, 'São Paulo', 'ESTADUAL'),
  criarOrgao('orgao-4', 'Defesa Civil de Taubaté', gerarCnpj('456789010001'), false, 'Taubaté'),
];

async function conferirTotais(page: Page, total: number, ativos: number, desativados: number) {
  await expect(page.getByText('Total de órgãos').locator('..')).toContainText(String(total));
  await expect(page.getByText('Ativos', { exact: true }).locator('..')).toContainText(String(ativos));
  await expect(page.getByText('Desativados', { exact: true }).locator('..')).toContainText(String(desativados));
}

async function abrirCadastro(page: Page) {
  await page.getByRole('button', { name: 'Novo órgão' }).click();
  return page.getByRole('dialog', { name: 'Cadastrar órgão' });
}

async function preencherObrigatorios(
  dialogo: ReturnType<Page['getByRole']>,
  nome: string,
  cnpj: string,
) {
  await dialogo.getByLabel('Nome do órgão').fill(nome);
  await dialogo.getByLabel('CNPJ').fill(cnpj);
  await dialogo.getByLabel('Município').fill('São José dos Campos');
  await dialogo.getByLabel('UF').fill('SP');
}

test.describe('Órgãos públicos', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    let orgaos = [...ORGAOS_INICIAIS];
    let proximoId = 5;
    api.responder('GET /orgaos', () => ({ body: orgaos }));
    api.responder('POST /orgaos', ({ corpo }) => {
      const dados = corpo as Partial<OrgaoApi>;
      const criado = criarOrgao(
        `orgao-${proximoId++}`,
        dados.nome ?? '',
        dados.cnpj ?? '',
        dados.ativo ?? true,
        dados.municipio ?? '',
        dados.esfera ?? 'MUNICIPAL',
      );
      orgaos = [{ ...criado, ...dados }, ...orgaos];
      return { status: 201, body: criado };
    });
    api.responder('PATCH /orgaos/:id', ({ params, corpo }) => {
      orgaos = orgaos.map((orgao) =>
        orgao.id === params.id ? { ...orgao, ...(corpo as Partial<OrgaoApi>) } : orgao,
      );
      return { body: orgaos.find((orgao) => orgao.id === params.id) };
    });
    api.responder('DELETE /orgaos/:id', ({ params }) => {
      orgaos = orgaos.map((orgao) =>
        orgao.id === params.id ? { ...orgao, ativo: false } : orgao,
      );
      return { body: orgaos.find((orgao) => orgao.id === params.id) };
    });
    await page.goto('/orgaos');
    await expect(page.getByRole('button', { name: 'Novo órgão' })).toBeVisible();
  });

  test('lista os órgãos com o CNPJ formatado e os totais', async ({ page }) => {
    await expect(page.getByRole('row', { name: /Prefeitura Municipal de Jacareí/ })).toContainText('23.456.789/0001-95');
    await expect(page.getByRole('row', { name: /Prefeitura Municipal de Jacareí/ })).toContainText('Ativo');
    await expect(page.getByRole('row', { name: /Defesa Civil de Taubaté/ })).toContainText('Desativado');
    await conferirTotais(page, 4, 2, 2);
  });

  test('filtra pelo nome, pelo CNPJ com ou sem máscara e pelo status', async ({ page }) => {
    const busca = page.getByLabel('Buscar');
    const linhas = page.getByRole('row').filter({ has: page.getByRole('cell') });

    await busca.fill('jacareí');
    await expect(linhas).toHaveCount(1);
    await expect(linhas).toContainText('Prefeitura Municipal de Jacareí');

    await busca.fill('34.567.890/0001');
    await expect(linhas).toHaveCount(1);
    await expect(linhas).toContainText('Coordenadoria Estadual de Proteção e Defesa Civil');

    await busca.fill('45678901');
    await expect(linhas).toHaveCount(1);
    await expect(linhas).toContainText('Defesa Civil de Taubaté');

    await busca.clear();
    await page.getByLabel('Status').selectOption('DESATIVADO');
    await expect(linhas).toHaveCount(2);
    await expect(page.getByRole('row', { name: /Defesa Civil de São José dos Campos/ })).toHaveCount(0);
  });

  test('cadastra um órgão com CNPJ alfanumérico', async ({ page }) => {
    const dialogo = await abrirCadastro(page);

    await preencherObrigatorios(dialogo, 'Defesa Civil de Caçapava', '');
    // O campo põe a máscara e as letras em maiúsculas enquanto digita.
    await dialogo.getByLabel('CNPJ').pressSequentially('12abc34501de35');
    await expect(dialogo.getByLabel('CNPJ')).toHaveValue('12.ABC.345/01DE-35');
    await dialogo.getByRole('button', { name: 'Cadastrar órgão' }).click();

    await expect(dialogo).toHaveCount(0);
    const linha = page.getByRole('row', { name: /Defesa Civil de Caçapava/ });
    await expect(linha).toContainText('12.ABC.345/01DE-35');
    await expect(linha).toContainText('Ativo');
    await conferirTotais(page, 5, 3, 2);
  });

  test('pagina de cinco em cinco órgãos', async ({ page }) => {
    const dialogo = await abrirCadastro(page);
    await preencherObrigatorios(dialogo, 'Defesa Civil de Caçapava', '11.222.333/0001-81');
    await dialogo.getByRole('button', { name: 'Cadastrar órgão' }).click();
    await expect(dialogo).toHaveCount(0);
    const segundoDialogo = await abrirCadastro(page);
    await preencherObrigatorios(segundoDialogo, 'Prefeitura Municipal de Paraibuna', '98.765.432/0001-98');
    await segundoDialogo.getByRole('button', { name: 'Cadastrar órgão' }).click();

    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    // O cadastro mais recente entra no topo.
    await expect(page.getByRole('row', { name: /Prefeitura Municipal de Paraibuna/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Defesa Civil de Taubaté/ })).toHaveCount(0);

    // Os botões da paginação só têm ícone: o "próxima" é o último ao lado do contador.
    await page.getByText('Página 1 de 2').locator('..').getByRole('button').last().click();

    await expect(page.getByText('Página 2 de 2')).toBeVisible();
    await expect(page.getByRole('row', { name: /Defesa Civil de Taubaté/ })).toBeVisible();
  });

  test('recusa CNPJ inválido e CNPJ já cadastrado', async ({ page }) => {
    const dialogo = await abrirCadastro(page);
    await preencherObrigatorios(dialogo, 'Órgão de teste', '');

    await dialogo.getByLabel('CNPJ').fill('11.222.333/0001-82');
    await dialogo.getByRole('button', { name: 'Cadastrar órgão' }).click();
    await expect(dialogo.getByRole('alert')).toHaveText('Informe um CNPJ válido, incluindo os dígitos verificadores.');

    await dialogo.getByLabel('CNPJ').fill('23.456.789/0001-95');
    await dialogo.getByRole('button', { name: 'Cadastrar órgão' }).click();
    await expect(dialogo.getByRole('alert')).toHaveText('Já existe um órgão cadastrado com esse CNPJ.');

    await dialogo.getByRole('button', { name: 'Cancelar' }).click();
    await expect(page.getByRole('row', { name: /Órgão de teste/ })).toHaveCount(0);
    await conferirTotais(page, 4, 2, 2);
  });

  test('edita um órgão e só desativa depois de confirmar', async ({ page }) => {
    await page.getByRole('row', { name: /Prefeitura Municipal de Jacareí/ }).getByRole('button', { name: 'Editar' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar órgão' });
    await expect(dialogo.getByLabel('CNPJ')).toHaveValue('23.456.789/0001-95');

    await dialogo.getByLabel('Nome do órgão').fill('Prefeitura de Jacareí');
    await dialogo.getByLabel('Status').selectOption('DESATIVADO');
    await dialogo.getByRole('button', { name: 'Salvar alterações' }).click();

    const confirmacao = page.getByRole('alertdialog', { name: 'Confirmar desativação do órgão?' });
    await expect(confirmacao).toContainText('Prefeitura de Jacareí será marcado como desativado');
    await confirmacao.getByRole('button', { name: 'Voltar' }).click();
    await expect(confirmacao).toHaveCount(0);
    await expect(dialogo).toBeVisible();
    await conferirTotais(page, 4, 2, 2);

    await dialogo.getByRole('button', { name: 'Salvar alterações' }).click();
    await confirmacao.getByRole('button', { name: 'Desativar órgão' }).click();

    await expect(dialogo).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Prefeitura de Jacareí/ })).toContainText('Desativado');
    await conferirTotais(page, 4, 1, 3);
  });

  test('reativa um órgão sem pedir confirmação', async ({ page }) => {
    await page.getByRole('row', { name: /Defesa Civil de Taubaté/ }).getByRole('button', { name: 'Editar' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Editar órgão' });

    await dialogo.getByLabel('Status').selectOption('ATIVO');
    await dialogo.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(dialogo).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Defesa Civil de Taubaté/ })).toContainText('Ativo');
    await conferirTotais(page, 4, 3, 1);
  });

  test.describe('pelo teclado', () => {
    test('o Tab fica dentro do cadastro e o Esc fecha, devolvendo o foco a quem abriu', async ({ page }) => {
      const dialogo = await abrirCadastro(page);
      await expect(dialogo.getByLabel('Nome do órgão')).toBeFocused();

      await page.keyboard.press('Shift+Tab');
      await expect(dialogo.getByRole('button', { name: 'Fechar modal' })).toBeFocused();
      await page.keyboard.press('Shift+Tab');
      await expect(dialogo.getByRole('button', { name: 'Cadastrar órgão' })).toBeFocused();
      await page.keyboard.press('Tab');
      await expect(dialogo.getByRole('button', { name: 'Fechar modal' })).toBeFocused();

      await page.keyboard.press('Escape');

      await expect(dialogo).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Novo órgão' })).toBeFocused();
    });

    test('o Esc na confirmação volta para a edição sem desativar', async ({ page }) => {
      const editar = page.getByRole('row', { name: /Prefeitura Municipal de Jacareí/ }).getByRole('button', { name: 'Editar' });
      await editar.click();
      const dialogo = page.getByRole('dialog', { name: 'Editar órgão' });
      await dialogo.getByLabel('Status').selectOption('DESATIVADO');
      await dialogo.getByRole('button', { name: 'Salvar alterações' }).click();
      const confirmacao = page.getByRole('alertdialog', { name: 'Confirmar desativação do órgão?' });
      await expect(confirmacao.getByRole('button', { name: 'Voltar' })).toBeFocused();

      await page.keyboard.press('Escape');

      await expect(confirmacao).toHaveCount(0);
      await expect(dialogo.getByRole('button', { name: 'Salvar alterações' })).toBeFocused();

      await page.keyboard.press('Escape');

      await expect(dialogo).toHaveCount(0);
      await expect(editar).toBeFocused();
      await expect(page.getByRole('row', { name: /Prefeitura Municipal de Jacareí/ })).toContainText('Ativo');
    });
  });
});
