import type { DashboardDados } from '@/lib/api';
import { ADMIN, LICITACAO_A, pagina, umaLicitacao, USUARIO_LICITACAO } from './support/dados';
import type { ApiFalsa } from './support/api-falsa';
import { expect, logarComo, test } from './support/teste';

const LICITACAO_B = umaLicitacao({ id: 'licitacao-b', codigoIdentificador: 'PMTAU-2026', orgaoNome: 'Prefeitura de Taubaté' });

const ESTACOES_POR_LICITACAO: Record<string, DashboardDados['estacoes']> = {
  [LICITACAO_A.id]: [{ id: 'estacao-centro', nome: 'Estação Centro', endereco: 'Rua A, 1' }],
  [LICITACAO_B.id]: [{ id: 'estacao-taubate', nome: 'Estação Taubaté', endereco: 'Rua B, 2' }],
};

function umDashboard(licitacaoId: string | null, estacaoId: string | null): DashboardDados {
  const todas = licitacaoId ? ESTACOES_POR_LICITACAO[licitacaoId] ?? [] : Object.values(ESTACOES_POR_LICITACAO).flat();
  // Como a API: com estação escolhida, a lista volta só com ela.
  const estacoes = estacaoId ? todas.filter((estacao) => estacao.id === estacaoId) : todas;
  return {
    licitacaoId,
    periodo: { de: '2026-10-23T12:00:00.000Z', ate: '2026-10-24T12:00:00.000Z' },
    estacoes,
    indicadores: { estacoesAtivas: estacoes.length, leituras: 2, media: 3.5, alarmesAbertos: 1 },
    series: estacoes.map((estacao) => ({
      parametroId: `chuva-${estacao.id}`,
      nome: 'Precipitação',
      unidade: 'mm',
      estacaoId: estacao.id,
      estacaoNome: estacao.nome,
      pontos: [
        { timestamp: '2026-10-24T10:00:00.000Z', valor: 2 },
        { timestamp: '2026-10-24T11:00:00.000Z', valor: 5 },
      ],
    })),
  };
}

/** `licitacaoDoUsuario`: como o backend, prende o usuário de licitação na dele. */
function responderDashboard(api: ApiFalsa, licitacaoDoUsuario?: string) {
  api.responder('GET /dashboard', ({ url }) => ({
    body: umDashboard(licitacaoDoUsuario ?? url.searchParams.get('licitacaoId'), url.searchParams.get('estacaoId')),
  }));
}

test.describe('Dashboard da Tecsus', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    responderDashboard(api);
    await page.goto('/dashboard');
  });

  test('abre o dashboard geral e filtra por licitação', async ({ page, api }) => {
    const licitacao = page.getByLabel('Licitação', { exact: true });
    const estacao = page.getByLabel('Estação', { exact: true });

    await expect(licitacao).toHaveValue('');
    await expect(page.getByText('Dashboard geral', { exact: false })).toBeVisible();
    await expect(estacao.locator('option')).toHaveText(['Todas as estações', 'Estação Centro', 'Estação Taubaté']);
    expect(api.chamadasDe('GET /dashboard')[0].url.searchParams.has('licitacaoId')).toBe(false);

    await estacao.selectOption('estacao-centro');
    await expect.poll(() => api.chamadasDe('GET /dashboard').at(-1)?.url.searchParams.get('estacaoId')).toBe('estacao-centro');
    // A lista do filtro continua com as outras estações.
    await expect(estacao.locator('option')).toHaveCount(3);

    await licitacao.selectOption(LICITACAO_B.id);

    await expect.poll(() => api.chamadasDe('GET /dashboard').at(-1)?.url.searchParams.get('licitacaoId')).toBe(LICITACAO_B.id);
    // Trocar a licitação limpa a estação e a lista passa a ser a da licitação escolhida.
    expect(api.chamadasDe('GET /dashboard').at(-1)?.url.searchParams.has('estacaoId')).toBe(false);
    await expect(estacao).toHaveValue('');
    await expect(estacao.locator('option')).toHaveText(['Todas as estações', 'Estação Taubaté']);

    await licitacao.selectOption('');
    await expect.poll(() => api.chamadasDe('GET /dashboard').at(-1)?.url.searchParams.has('licitacaoId')).toBe(false);
  });
});

test.describe('Dashboard do usuário de licitação', () => {
  test('mostra a licitação do painel, sem seletor', async ({ page, api }) => {
    logarComo(api, USUARIO_LICITACAO);
    responderDashboard(api, LICITACAO_A.id);

    await page.goto('/dashboard');

    await expect(page.getByText(`Painel da licitação ${LICITACAO_A.codigoIdentificador}`, { exact: false })).toBeVisible();
    await expect(page.getByLabel('Licitação', { exact: true })).toHaveCount(0);
    await expect(page.getByLabel('Estação', { exact: true }).locator('option')).toHaveText(['Todas as estações', 'Estação Centro']);
    // O backend filtra a licitação dele: a tela não manda licitacaoId.
    expect(api.chamadasDe('GET /dashboard').every((chamada) => !chamada.url.searchParams.has('licitacaoId'))).toBe(true);
  });
});

test.describe('Dashboard no celular', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('cabe em 375 px sem rolagem horizontal', async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    responderDashboard(api);

    await page.goto('/dashboard');
    await expect(page.getByRole('img', { name: 'Gráfico histórico de Chuva acumulada' }).first()).toBeVisible();

    const conteudo = page.locator('main');
    expect(await conteudo.evaluate((main) => main.scrollWidth - main.clientWidth)).toBeLessThanOrEqual(0);
  });
});
