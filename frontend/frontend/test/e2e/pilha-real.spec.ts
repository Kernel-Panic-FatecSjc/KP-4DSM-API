import { expect, test } from '@playwright/test';

// Ponta a ponta com a pilha real (API, banco semeado, front de produção): o que
// os funcionais não cobrem, porque lá a API é falsa. Login com o usuário do
// seed (SEED_USUARIO_*) e uma tela que lê do banco.
const EMAIL = process.env.SEED_USUARIO_EMAIL ?? 'admin@kernelpanic.dev';
const SENHA = process.env.SEED_USUARIO_SENHA ?? 'admin12345';

test('login com o usuário do seed e a lista de usuários vem do banco', async ({ page }) => {
  await page.goto('/usuarios');
  await expect(page).toHaveURL(/\/login/);

  await page.getByPlaceholder('Email').fill(EMAIL);
  await page.getByPlaceholder('Senha').fill(SENHA);
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL('/usuarios');
  await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
  await expect(page.getByText(EMAIL)).toBeVisible();
});

test('senha errada é recusada pela API de verdade', async ({ page }) => {
  await page.goto('/login');
  await page.getByPlaceholder('Email').fill(EMAIL);
  await page.getByPlaceholder('Senha').fill('senha-que-nao-existe');
  await page.getByRole('button', { name: 'Entrar' }).click();

  await expect(page).toHaveURL(/\/login/);
  await expect(page.getByRole('alert').or(page.getByText(/inválid/i)).first()).toBeVisible();
});
