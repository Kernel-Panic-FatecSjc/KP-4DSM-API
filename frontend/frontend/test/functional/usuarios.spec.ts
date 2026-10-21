import type { Usuario } from '@/lib/api';
import { ADMIN, umUsuario } from './support/dados';
import { expect, logarComo, test } from './support/teste';

const ANA = umUsuario({ id: 'ana', nome: 'Ana Souza', email: 'ana@kp.dev' });
const BRUNO = umUsuario({ id: 'bruno', nome: 'Bruno Lima', email: 'bruno@kp.dev', ativo: false });

test.describe('Usuários', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /usuarios', { body: [ADMIN, ANA, BRUNO] });
    await page.goto('/usuarios');
  });

  test('lista os usuários com os totais', async ({ page }) => {
    await expect(page.getByRole('row', { name: /Ana Souza/ })).toContainText('Ativo');
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
    await page.getByRole('combobox').selectOption('ATIVOS');
    await expect(page.getByRole('row', { name: /Ana Souza/ })).toBeVisible();
    await expect(page.getByRole('row', { name: /Bruno Lima/ })).toHaveCount(0);
  });

  test('cadastra um usuário novo', async ({ page, api }) => {
    api.responder('POST /usuarios', ({ corpo }) => {
      const { nome, email } = corpo as Pick<Usuario, 'nome' | 'email'>;
      return { status: 201, body: umUsuario({ id: 'carla', nome, email }) };
    });

    await page.getByLabel('Nome').fill('Carla Dias');
    await page.getByLabel('Email').fill('carla@kp.dev');
    await page.getByLabel('Senha').fill('senha-forte');
    await page.getByRole('button', { name: 'Cadastrar' }).click();

    await expect(page.getByRole('row', { name: /Carla Dias/ })).toBeVisible();
    await expect(page.getByLabel('Nome')).toHaveValue('');
    expect(api.chamadasDe('POST /usuarios')[0].corpo).toEqual({
      nome: 'Carla Dias',
      email: 'carla@kp.dev',
      senha: 'senha-forte',
    });
  });

  test('mostra o erro da API ao cadastrar e-mail repetido', async ({ page, api }) => {
    api.responder('POST /usuarios', { status: 409, body: { statusCode: 409, message: 'E-mail já cadastrado' } });

    await page.getByLabel('Nome').fill('Ana de novo');
    await page.getByLabel('Email').fill('ana@kp.dev');
    await page.getByLabel('Senha').fill('senha-forte');
    await page.getByRole('button', { name: 'Cadastrar' }).click();

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
