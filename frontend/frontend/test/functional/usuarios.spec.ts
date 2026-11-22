import type { Usuario } from '@/lib/api';
import {
  ADMIN,
  ADMIN_LICITACAO,
  ADMIN_LICITACAO_ENCERRADA,
  LICITACAO_A,
  pagina,
  umUsuario,
  USUARIO_LICITACAO,
} from './support/dados';
import { expect, logarComo, test } from './support/teste';

const ANA = umUsuario({ id: 'ana', nome: 'Ana Souza', email: 'ana@kp.dev' });
const BRUNO = umUsuario({ id: 'bruno', nome: 'Bruno Lima', email: 'bruno@kp.dev', ativo: false });
const OUTRO_ADMIN = umUsuario({ id: 'outro-admin', nome: 'Outro Admin', email: 'outro.admin@kp.dev', tipo: 'ADMIN_LICITACAO' });

test.describe('Usuários (Tecsus)', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /usuarios', { body: [ADMIN, ANA, BRUNO] });
    // Seletores de licitação do cadastro e do filtro.
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A]) });
    await page.goto('/usuarios');
  });

  test('lista os usuários com perfil, licitação e totais', async ({ page }) => {
    const ana = page.getByRole('row', { name: /Ana Souza/ });
    await expect(ana).toContainText('Ativo');
    await expect(ana).toContainText('Usuário da licitação');
    await expect(ana).toContainText('PMSJC-2026');
    await expect(page.getByRole('row', { name: /Admin Kernel Panic/ })).toContainText('Admin Tecsus');
    await expect(page.getByRole('row', { name: /Bruno Lima/ })).toContainText('Inativo');
    await expect(page.getByText('Total de usuários').locator('..')).toContainText('3');
    await expect(page.getByText('Usuários ativos').locator('..')).toContainText('2');
    await expect(page.getByText('Usuários inativos').locator('..')).toContainText('1');
  });

  test('filtra pela busca e pelo status', async ({ page }) => {
    await page.getByPlaceholder('Buscar por nome ou email...').fill('bruno@');
    await expect(page.getByRole('row', { name: /Bruno Lima/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Ana Souza/ })).toHaveCount(0);

    await page.getByPlaceholder('Buscar por nome ou email...').clear();
    await page.getByLabel('Status').selectOption('ATIVOS');
    await expect(page.getByRole('row', { name: /Ana Souza/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Bruno Lima/ })).toHaveCount(0);
  });

  test('filtra pela licitação e pelo perfil na API', async ({ page, api }) => {
    const filtros = page.getByRole('region', { name: 'Filtros de usuários' });

    await filtros.getByLabel('Licitação').selectOption(LICITACAO_A.id);
    await filtros.getByLabel('Perfil').selectOption('ADMIN_LICITACAO');

    await expect
      .poll(() => api.chamadasDe('GET /usuarios').at(-1)?.url.searchParams.toString())
      .toBe(`licitacaoId=${LICITACAO_A.id}&tipo=ADMIN_LICITACAO`);
  });

  test('cadastra um admin da licitação escolhendo a licitação', async ({ page, api }) => {
    api.responder('POST /usuarios', ({ corpo }) => {
      const { nome, email } = corpo as Pick<Usuario, 'nome' | 'email'>;
      return { status: 201, body: umUsuario({ id: 'carla', nome, email, tipo: 'ADMIN_LICITACAO' }) };
    });
    const formulario = page.getByRole('form', { name: 'Cadastrar usuário' });

    await formulario.getByLabel('Nome').fill('Carla Dias');
    await formulario.getByLabel('Email').fill('carla@kp.dev');
    await formulario.getByLabel('Senha').fill('senha-forte');
    await formulario.getByLabel('Perfil').selectOption('ADMIN_LICITACAO');

    // Sem licitação o cadastro nem chega na API.
    await formulario.getByRole('button', { name: 'Cadastrar' }).click();
    await expect(page.getByText('Selecione a licitação do usuário.')).toBeVisible();
    expect(api.chamadasDe('POST /usuarios')).toHaveLength(0);

    await formulario.getByLabel('Licitação').selectOption(LICITACAO_A.id);
    await formulario.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page.getByRole('row', { name: /Carla Dias/ })).toContainText('Admin da licitação');
    await expect(formulario.getByLabel('Nome')).toHaveValue('');
    expect(api.chamadasDe('POST /usuarios')[0].corpo).toEqual({
      nome: 'Carla Dias',
      email: 'carla@kp.dev',
      senha: 'senha-forte',
      tipo: 'ADMIN_LICITACAO',
      licitacaoId: LICITACAO_A.id,
    });
  });

  test('cadastra um admin da Tecsus sem licitação', async ({ page, api }) => {
    api.responder('POST /usuarios', { status: 201, body: umUsuario({ id: 'davi', nome: 'Davi', tipo: 'ADMIN_TECSUS', licitacao: null }) });
    const formulario = page.getByRole('form', { name: 'Cadastrar usuário' });

    await formulario.getByLabel('Nome').fill('Davi');
    await formulario.getByLabel('Email').fill('davi@kp.dev');
    await formulario.getByLabel('Senha').fill('senha-forte');
    await formulario.getByLabel('Perfil').selectOption('ADMIN_TECSUS');
    await expect(formulario.getByLabel('Licitação')).toHaveCount(0);
    await formulario.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page.getByRole('row', { name: /Davi/ })).toBeVisible();
    expect(api.chamadasDe('POST /usuarios')[0].corpo).toEqual({
      nome: 'Davi',
      email: 'davi@kp.dev',
      senha: 'senha-forte',
      tipo: 'ADMIN_TECSUS',
    });
  });

  test('mostra o erro da API ao cadastrar e-mail repetido', async ({ page, api }) => {
    api.responder('POST /usuarios', { status: 409, body: { statusCode: 409, message: 'E-mail já cadastrado' } });
    const formulario = page.getByRole('form', { name: 'Cadastrar usuário' });

    await formulario.getByLabel('Nome').fill('Ana de novo');
    await formulario.getByLabel('Email').fill('ana@kp.dev');
    await formulario.getByLabel('Senha').fill('senha-forte');
    await formulario.getByLabel('Licitação').selectOption(LICITACAO_A.id);
    await formulario.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page.getByText('E-mail já cadastrado')).toBeVisible();
  });

  test('inativa um usuário depois de confirmar', async ({ page, api }) => {
    api.responder('DELETE /usuarios/:id', { body: { ...ANA, ativo: false } });
    page.once('dialog', (dialogo) => {
      expect(dialogo.message()).toBe('Inativar Ana Souza? Ele deixa de conseguir logar.');
      void dialogo.accept();
    });

    const linha = page.getByRole('row', { name: /Ana Souza/ });
    await linha.getByRole('button', { name: 'Inativar' }).click();

    await expect(linha).toContainText('Inativo');
    expect(api.chamadasDe('DELETE /usuarios/:id')[0].params).toEqual({ id: 'ana' });
  });

  test('não chama a API quando a inativação é cancelada', async ({ page, api }) => {
    page.once('dialog', (dialogo) => void dialogo.dismiss());

    await page.getByRole('row', { name: /Ana Souza/ }).getByRole('button', { name: 'Inativar' }).click();

    await expect(page.getByRole('row', { name: /Ana Souza/ })).toContainText('Ativo');
    expect(api.chamadasDe('DELETE /usuarios/:id')).toHaveLength(0);
  });

  test('não deixa o usuário logado se inativar', async ({ page }) => {
    const linha = page.getByRole('row', { name: /Admin Kernel Panic/ });

    await expect(linha).toContainText('(você)');
    await expect(linha.getByRole('button', { name: 'Inativar' })).toHaveCount(0);
  });
});

test.describe('Usuários (admin da licitação)', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    api.responder('GET /usuarios', { body: [ADMIN_LICITACAO, OUTRO_ADMIN, ANA] });
    await page.goto('/usuarios');
    await expect(page.getByRole('row', { name: /Ana Souza/ })).toBeVisible();
  });

  test('cadastra usuário comum sem escolher perfil nem licitação', async ({ page, api }) => {
    api.responder('POST /usuarios', { status: 201, body: umUsuario({ id: 'elisa', nome: 'Elisa Prado', email: 'elisa@kp.dev' }) });
    const formulario = page.getByRole('form', { name: 'Cadastrar usuário' });

    await expect(formulario.getByLabel('Perfil')).toHaveCount(0);
    await expect(formulario.getByLabel('Licitação')).toHaveCount(0);
    await expect(formulario).toContainText('O usuário entra como usuário da licitação em PMSJC-2026');

    await formulario.getByLabel('Nome').fill('Elisa Prado');
    await formulario.getByLabel('Email').fill('elisa@kp.dev');
    await formulario.getByLabel('Senha').fill('senha-forte');
    await formulario.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page.getByRole('row', { name: /Elisa Prado/ })).toBeVisible();
    // O backend aplica a licitação do admin.
    expect(api.chamadasDe('POST /usuarios')[0].corpo).toEqual({
      nome: 'Elisa Prado',
      email: 'elisa@kp.dev',
      senha: 'senha-forte',
    });
    expect(api.chamadasDe('GET /licitacoes')).toHaveLength(0);
  });

  test('gerencia só os usuários comuns da licitação', async ({ page }) => {
    await expect(page.getByRole('region', { name: 'Filtros de usuários' }).getByLabel('Perfil')).toHaveCount(0);

    const ana = page.getByRole('row', { name: /Ana Souza/ });
    await expect(ana.getByRole('button', { name: 'Inativar' })).toBeVisible();
    await expect(ana.getByRole('link', { name: 'Editar' })).toBeVisible();

    const outroAdmin = page.getByRole('row', { name: /Outro Admin/ });
    await expect(outroAdmin.getByRole('button', { name: 'Inativar' })).toHaveCount(0);
    await expect(outroAdmin.getByRole('link', { name: 'Editar' })).toHaveCount(0);
  });
});

test.describe('Usuários sem permissão de escrita', () => {
  test('admin de licitação encerrada só lê', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO_ENCERRADA);
    api.responder('GET /usuarios', { body: [ADMIN_LICITACAO_ENCERRADA, ANA] });

    await page.goto('/usuarios');

    await expect(page.getByRole('row', { name: /Ana Souza/ })).toBeVisible();
    await expect(page.getByRole('form', { name: 'Cadastrar usuário' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: 'Cadastrar' })).toHaveCount(0);
    await expect(page.getByRole('button', { name: /Inativar|Ativar/ })).toHaveCount(0);
    await expect(page.getByRole('link', { name: 'Editar' })).toHaveCount(0);
  });

  test('usuário comum não vê a tela', async ({ page, api }) => {
    logarComo(api, USUARIO_LICITACAO);

    await page.goto('/usuarios');

    await expect(page.getByText('Esta página está disponível somente para administradores.')).toBeVisible();
    expect(api.chamadasDe('GET /usuarios')).toHaveLength(0);
  });
});
