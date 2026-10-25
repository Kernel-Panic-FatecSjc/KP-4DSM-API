import type { Page, Route } from '@playwright/test';
import type { RegistroAuditoria } from '@/lib/api';
import type { ApiFalsa } from './support/api-falsa';
import { ADMIN, ADMIN_LICITACAO, LICITACAO_A, pagina, umaLicitacao } from './support/dados';
import { expect, logarComo, test } from './support/teste';

const LICITACAO_B = umaLicitacao({ id: 'licitacao-b', codigoIdentificador: 'PMTAU-2026', orgaoNome: 'Prefeitura de Taubaté' });

function umRegistro(dados: Partial<RegistroAuditoria> = {}): RegistroAuditoria {
  return {
    id: 'registro-1',
    criadoEm: '2026-10-18T15:30:00.000Z',
    acao: 'usuarios.criar',
    entidade: 'Usuario',
    entidadeId: 'usuario-1',
    enderecoIp: '177.10.*.*',
    detalhes: { nome: 'Ana Souza' },
    usuario: { id: ADMIN_LICITACAO.id, nome: ADMIN_LICITACAO.nome },
    licitacaoId: LICITACAO_A.id,
    ...dados,
  };
}

// Datas do filtro no fuso dos testes (America/Sao_Paulo, -03:00), como a tela converte.
const DE = '2026-10-01';
const ATE = '2026-10-20';

/** Download por navegação: responde como a API real (anexo CSV), fora da API falsa. */
async function responderExportacao(page: Page): Promise<URL[]> {
  const pedidos: URL[] = [];
  await page.route(
    (url) => url.pathname.endsWith('/auditoria/exportar'),
    (route: Route) => {
      pedidos.push(new URL(route.request().url()));
      return route.fulfill({
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="auditoria.csv"' },
        contentType: 'text/csv; charset=utf-8',
        body: 'cabecalho\r\n',
      });
    },
  );
  return pedidos;
}

function ultimaConsulta(api: ApiFalsa): URLSearchParams {
  return api.chamadasDe('GET /auditoria').at(-1)!.url.searchParams;
}

test.describe('Auditoria pela Tecsus', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    api.responder('GET /auditoria', {
      body: pagina([umRegistro(), umRegistro({ id: 'registro-2', acao: 'licitacoes.criar', usuario: { id: ADMIN.id, nome: ADMIN.nome }, licitacaoId: null })]),
    });
    await page.goto('/auditoria');
  });

  test('vê a trilha de todas as licitações e filtra por uma', async ({ page, api }) => {
    await expect(page.getByText('em todas as licitações')).toBeVisible();
    await expect(page.getByRole('row', { name: /usuarios · criar/ })).toContainText('PMSJC-2026');
    await expect(page.getByRole('row', { name: /licitacoes · criar/ })).toContainText('Tecsus / visitante');

    await page.getByLabel('Licitação').selectOption(LICITACAO_B.id);
    await page.getByRole('button', { name: 'Consultar registros' }).click();

    await expect.poll(() => ultimaConsulta(api).get('licitacaoId')).toBe(LICITACAO_B.id);
  });

  test('exportar CSV exige o período', async ({ page }) => {
    const pedidos = await responderExportacao(page);
    await expect(page.getByRole('row', { name: /usuarios · criar/ })).toBeVisible();

    await page.getByRole('button', { name: 'CSV' }).click();

    await expect(page.getByText('Informe a data inicial e a data final para exportar o CSV.')).toBeVisible();
    expect(pedidos).toHaveLength(0);
  });

  test('com o período, baixa o CSV gerado pela API', async ({ page }) => {
    const pedidos = await responderExportacao(page);

    await page.getByLabel('Licitação').selectOption(LICITACAO_A.id);
    await page.getByLabel('Ação', { exact: true }).fill('usuarios.criar');
    await page.getByLabel('Data inicial').fill(DE);
    await page.getByLabel('Data final').fill(ATE);
    await page.getByRole('button', { name: 'CSV' }).click();

    await expect.poll(() => pedidos.length).toBe(1);
    expect(Object.fromEntries(pedidos[0].searchParams)).toEqual({
      acao: 'usuarios.criar',
      licitacaoId: LICITACAO_A.id,
      de: '2026-10-01T03:00:00.000Z',
      ate: '2026-10-21T02:59:59.999Z',
    });
    await expect(page.getByRole('heading', { name: 'Auditoria', level: 1 })).toBeVisible();
  });

  test('o Excel formatado avisa quando passa de 5.000 registros, sem baixar tudo', async ({ page, api }) => {
    api.responder('GET /auditoria', ({ url }) => ({
      body: { itens: [umRegistro()], total: 7200, pagina: 1, tamanho: Number(url.searchParams.get('tamanho')) },
    }));

    await page.getByRole('button', { name: 'Excel formatado' }).click();

    await expect(page.getByText(/7\.200 registros e o Excel formatado vai até 5\.000/)).toBeVisible();
    const lotes = api.chamadasDe('GET /auditoria').filter((chamada) => chamada.url.searchParams.get('tamanho') === '200');
    expect(lotes).toHaveLength(1);
  });
});

test.describe('Auditoria pelo admin da licitação', () => {
  test('vê só a trilha da própria licitação, sem seletor', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    api.responder('GET /auditoria', { body: pagina([umRegistro()]) });
    await page.goto('/auditoria');

    await expect(page.getByRole('row', { name: /usuarios · criar/ })).toBeVisible();
    await expect(page.getByText('Rastreabilidade das ações da sua licitação.')).toBeVisible();
    await expect(page.getByLabel('Licitação')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Licitação' })).toHaveCount(0);
    expect(ultimaConsulta(api).has('licitacaoId')).toBe(false);
  });
});
