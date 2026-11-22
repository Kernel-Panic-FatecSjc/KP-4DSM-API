import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import LoginPage from '@/app/login/page';
import { API_URL } from '@/lib/api';
import { mockarFetch, pendente, responde } from '../helpers';

const navegacao = vi.hoisted(() => ({
  busca: new URLSearchParams(),
  router: { push: vi.fn(), replace: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  useRouter: () => navegacao.router,
  useSearchParams: () => navegacao.busca,
}));

async function entrar(email = 'admin@kp.dev', senha = 'senha-forte') {
  const usuario = userEvent.setup();
  await usuario.type(screen.getByPlaceholderText('Email'), email);
  await usuario.type(screen.getByPlaceholderText('Senha'), senha);
  await usuario.click(screen.getByRole('button', { name: 'Entrar' }));
}

function abrirLogin(query = '') {
  navegacao.busca = new URLSearchParams(query);
  render(<LoginPage />);
}

describe('Página de login', () => {
  it('envia e-mail e senha para a API', async () => {
    const fetchMock = mockarFetch(responde(200, { id: '1' }));
    abrirLogin();

    await entrar('admin@kp.dev', 'senha-forte');

    expect(fetchMock).toHaveBeenCalledWith(
      `${API_URL}/autenticacao/login`,
      expect.objectContaining({ method: 'POST', body: JSON.stringify({ email: 'admin@kp.dev', senha: 'senha-forte' }) }),
    );
  });

  it.each([
    ['', '/dashboard'],
    ['proximo=/usuarios', '/usuarios'],
    // Redirecionamento aberto: só aceita caminho do próprio site.
    ['proximo=//site-malicioso.com', '/dashboard'],
    ['proximo=https://site-malicioso.com', '/dashboard'],
  ])('com "%s" vai para %s depois de entrar', async (query, destino) => {
    mockarFetch(responde(200, { id: '1' }));
    abrirLogin(query);

    await entrar();

    await vi.waitFor(() => expect(navegacao.router.push).toHaveBeenCalledWith(destino));
  });

  it('mostra a mensagem da API quando as credenciais estão erradas', async () => {
    mockarFetch(responde(401, { message: 'Credenciais inválidas' }));
    abrirLogin();

    await entrar();

    expect(await screen.findByText('Credenciais inválidas')).toBeInTheDocument();
    expect(navegacao.router.push).not.toHaveBeenCalled();
  });

  it('desabilita o botão enquanto o login está em andamento', async () => {
    mockarFetch(pendente());
    abrirLogin();

    await entrar();

    expect(screen.getByRole('button', { name: 'Entrando...' })).toBeDisabled();
  });
});
