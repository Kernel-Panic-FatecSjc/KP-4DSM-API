import { regiaoDaUf } from '@/lib/regiao';
import { FILTROS_ALARMES, FILTROS_ALERTAS, pagina, SEM_ALERTAS, umAlarme } from './support/dados';
import type { ApiFalsa } from './support/api-falsa';
import { expect, test } from './support/teste';

const ROTAS_PRIVADAS = [
  '/dashboard',
  '/gerenciamento-de-alertas',
  '/estacoes',
  '/sensores',
  '/leituras-brutas',
  '/usuarios',
  '/auditoria',
  '/contratos',
  '/orgaos',
  '/alarmes',
  '/alertas',
];

test.describe('Rotas privadas sem login', () => {
  for (const rota of ROTAS_PRIVADAS) {
    test(`${rota} manda para o login`, async ({ page }) => {
      await page.goto(rota);

      await expect(page).toHaveURL(`/login?proximo=${encodeURIComponent(rota)}`);
      await expect(page.getByRole('button', { name: 'Entrar' })).toBeVisible();
    });
  }
});

test.describe('Alertas globais para o visitante', () => {
  function responderAlertas(api: ApiFalsa) {
    api
      .responder('GET /alarmes/filtros', { body: FILTROS_ALARMES })
      .responder('GET /alarmes', { body: pagina([umAlarme({ estacao: { id: 'estacao-1', nome: 'Estação Centro' } })]) })
      .responder('GET /alertas/filtros', { body: FILTROS_ALERTAS })
      .responder('GET /alertas', { body: SEM_ALERTAS });
  }

  test('escolhe o estado e vê os alarmes da região', async ({ page, api }) => {
    responderAlertas(api);

    await page.goto('/alertas-globais');
    await expect(page.getByRole('heading', { name: 'Alertas perto de você' })).toBeVisible();
    // Sem a localização liberada, o visitante escolhe o estado.
    await page.getByLabel('Escolher estado').selectOption('SP');

    await expect(page.getByText('Alertas num raio de 100 km de São Paulo (SP)')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Ver detalhes da ocorrência em Estação Centro' })).toBeVisible();

    // A API só responde ao visitante com a região na query.
    const consultas = () => api.chamadas.filter((chamada) => chamada.rota !== 'GET /autenticacao/perfil');
    await expect
      .poll(() => consultas().map((chamada) => chamada.rota))
      .toEqual(expect.arrayContaining(['GET /alarmes/filtros', 'GET /alarmes', 'GET /alertas/filtros', 'GET /alertas']));
    const sp = regiaoDaUf('SP')!;
    for (const chamada of consultas()) {
      expect(chamada.url.searchParams.get('latitude'), chamada.url.pathname).toBe(String(sp.latitude));
      expect(chamada.url.searchParams.get('longitude'), chamada.url.pathname).toBe(String(sp.longitude));
    }
  });

  test.describe('com a localização liberada', () => {
    test.use({ geolocation: { latitude: -23.1896, longitude: -45.8841 }, permissions: ['geolocation'] });

    test('usa a posição do navegador', async ({ page, api }) => {
      responderAlertas(api);

      await page.goto('/alertas-globais');

      await expect(page.getByText('Alertas num raio de 100 km de sua localização')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Ver detalhes da ocorrência em Estação Centro' })).toBeVisible();
      const historico = api.chamadasDe('GET /alarmes')[0];
      expect(historico.url.searchParams.get('latitude')).toBe('-23.1896');
      expect(historico.url.searchParams.get('longitude')).toBe('-45.8841');
    });
  });

  test('mostra só as abas públicas no menu', async ({ page }) => {
    await page.goto('/alertas-globais');

    const menu = page.getByRole('complementary', { name: 'Navegação principal' });
    await expect(menu.getByRole('link', { name: 'Alertas Globais' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Usuários' })).toHaveCount(0);
    await expect(menu.getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login?proximo=%2Falertas-globais');
  });
});
