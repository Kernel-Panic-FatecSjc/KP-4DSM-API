import { ADMIN, LICITACAO_A, pagina } from './support/dados';
import { expect, SEM_SESSAO, test } from './support/teste';

test.describe('Login', () => {
  test('entra e volta para a página que tinha pedido', async ({ page, api }) => {
    // O cookie de sessão nasce no login: antes dele o perfil responde 401.
    let logado = false;
    api.responder('POST /autenticacao/login', () => {
      logado = true;
      return { body: ADMIN };
    });
    api.responder('GET /autenticacao/perfil', () => (logado ? { body: ADMIN } : SEM_SESSAO));
    api.responder('GET /usuarios', { body: [ADMIN] });
    // A Tecsus tem o seletor de licitação na tela de usuários.
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A]) });

    await page.goto('/usuarios');
    await expect(page).toHaveURL('/login?proximo=%2Fusuarios');

    await page.getByPlaceholder('Email').fill('admin@kp.dev');
    await page.getByPlaceholder('Senha').fill('senha-forte');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page).toHaveURL('/usuarios');
    await expect(page.getByRole('heading', { name: 'Usuários' })).toBeVisible();
    expect(api.chamadasDe('POST /autenticacao/login')[0].corpo).toEqual({
      email: 'admin@kp.dev',
      senha: 'senha-forte',
    });
  });

  test('mostra o erro da API e continua no login', async ({ page, api }) => {
    api.responder('POST /autenticacao/login', { status: 401, body: { statusCode: 401, message: 'Credenciais inválidas' } });

    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('admin@kp.dev');
    await page.getByPlaceholder('Senha').fill('senha-errada');
    await page.getByRole('button', { name: 'Entrar' }).click();

    await expect(page.getByText('Credenciais inválidas')).toBeVisible();
    await expect(page).toHaveURL('/login');
  });

  test('não envia o formulário com o e-mail inválido', async ({ page, api }) => {
    await page.goto('/login');
    await page.getByPlaceholder('Email').fill('admin');
    await page.getByPlaceholder('Senha').fill('senha-forte');
    await page.getByRole('button', { name: 'Entrar' }).click();

    // Validação nativa do navegador (type="email"): nada chega na API.
    const emailValido = await page.getByPlaceholder('Email').evaluate((campo: HTMLInputElement) => campo.validity.valid);
    expect(emailValido).toBe(false);
    expect(api.chamadasDe('POST /autenticacao/login')).toHaveLength(0);
  });
});
