import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { ehRotaPublica, ProtectedLayout, useSessao } from '@/components/ProtectedLayout';
import { falhaDeRede, mockarFetch, pendente, responde } from '../helpers';

// Fora do Next não existe roteador: o next/navigation é trocado por um falso.
// O router precisa ser o mesmo objeto a cada render, como no Next, senão o
// useEffect que depende dele roda de novo a cada render.
const navegacao = vi.hoisted(() => ({
  pathname: '/',
  router: { replace: vi.fn(), push: vi.fn() },
}));

vi.mock('next/navigation', () => ({
  usePathname: () => navegacao.pathname,
  useRouter: () => navegacao.router,
}));

function MostrarSessao() {
  return <p>sessão: {useSessao()}</p>;
}

function renderizarEm(pathname: string) {
  navegacao.pathname = pathname;
  render(
    <ProtectedLayout>
      <MostrarSessao />
    </ProtectedLayout>,
  );
}

describe('ehRotaPublica', () => {
  it.each([
    ['/alertas-globais', true],
    ['/alertas-globais/detalhe', true],
    ['/alertas-globais-falso', false],
    ['/usuarios', false],
    ['/', false],
  ])('%s → %s', (pathname, esperado) => {
    expect(ehRotaPublica(pathname)).toBe(esperado);
  });
});

describe('ProtectedLayout', () => {
  it('segura a página enquanto verifica a sessão', () => {
    mockarFetch(pendente());

    renderizarEm('/usuarios');

    expect(screen.getByText('Verificando autenticação...')).toBeInTheDocument();
    expect(screen.queryByText(/sessão:/)).not.toBeInTheDocument();
  });

  it('mostra a página para quem está logado', async () => {
    mockarFetch(responde(200, { id: '1' }));

    renderizarEm('/usuarios');

    expect(await screen.findByText('sessão: autenticado')).toBeInTheDocument();
    expect(navegacao.router.replace).not.toHaveBeenCalled();
  });

  it('manda para o login, lembrando a página pedida, quando a sessão expirou', async () => {
    mockarFetch(responde(401, { message: 'Sessão inválida' }));

    renderizarEm('/usuarios');

    await vi.waitFor(() => expect(navegacao.router.replace).toHaveBeenCalledWith('/login?proximo=%2Fusuarios'));
    expect(screen.queryByText(/sessão:/)).not.toBeInTheDocument();
  });

  it('manda para o login sem "proximo" quando a API está fora do ar', async () => {
    mockarFetch(falhaDeRede());

    renderizarEm('/usuarios');

    await vi.waitFor(() => expect(navegacao.router.replace).toHaveBeenCalledWith('/login'));
  });

  it('deixa o visitante ver uma rota pública', async () => {
    mockarFetch(responde(401, { message: 'Sessão inválida' }));

    renderizarEm('/alertas-globais');

    expect(await screen.findByText('sessão: visitante')).toBeInTheDocument();
    expect(navegacao.router.replace).not.toHaveBeenCalled();
  });
});
