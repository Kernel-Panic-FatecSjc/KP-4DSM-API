import type { Page, Route } from '@playwright/test';
import type { LeituraBruta, LeituraErro } from '@/lib/api';
import type { ApiFalsa } from './support/api-falsa';
import { ADMIN, ADMIN_LICITACAO, LICITACAO_A, USUARIO_LICITACAO, pagina, umaLicitacao } from './support/dados';
import { expect, logarComo, test } from './support/teste';

const LICITACAO_B = umaLicitacao({ id: 'licitacao-b', codigoIdentificador: 'PMTAU-2026', orgaoNome: 'Prefeitura de Taubaté' });

function umaLeituraBruta(dados: Partial<LeituraBruta> = {}): LeituraBruta {
  return {
    id: 'leitura-1',
    vidEstacao: 'aa:bb:cc:dd:ee:01',
    recebidoEm: '2026-10-18T15:30:00.000Z',
    unixtimeDispositivo: '1792337400',
    latitude: -23.1896,
    longitude: -45.8841,
    payload: { Pluviometro: 12.5 },
    ...dados,
  };
}

function umaLeituraErro(dados: Partial<LeituraErro> = {}): LeituraErro {
  return {
    id: 'erro-1',
    leituraBrutaId: 'leitura-1',
    vidEstacao: 'aa:bb:cc:dd:ee:01',
    nomeSensor: 'Pluviometro',
    parametroId: 'parametro-1',
    licitacaoId: LICITACAO_A.id,
    valor: 180,
    unixtime: '1792337400',
    motivo: 'ACIMA_DO_MAXIMO',
    valorMinimo: 0,
    valorMaximo: 100,
    registradoEm: '2026-10-18T15:30:01.000Z',
    ...dados,
  };
}

// Datas do filtro no fuso dos testes (America/Sao_Paulo, -03:00), como a tela converte.
const DE = '2026-10-01';
const ATE = '2026-10-20';
const DE_ISO = '2026-10-01T03:00:00.000Z';
const ATE_ISO = '2026-10-21T02:59:59.999Z';

/**
 * A exportação é um download por navegação, não um fetch: responde aqui como a
 * API real (anexo CSV) para o navegador baixar em vez de sair da página.
 */
async function responderExportacao(page: Page, caminho: string): Promise<URL[]> {
  const pedidos: URL[] = [];
  await page.route(
    (url) => url.pathname.endsWith(caminho),
    (route: Route) => {
      pedidos.push(new URL(route.request().url()));
      return route.fulfill({
        status: 200,
        headers: { 'content-disposition': 'attachment; filename="exportacao.csv"' },
        contentType: 'text/csv; charset=utf-8',
        body: 'cabecalho\r\n',
      });
    },
  );
  return pedidos;
}

function ultimaConsulta(api: ApiFalsa, rota: '/leituras-brutas' | '/leituras-erro'): URLSearchParams {
  return api.chamadasDe(`GET ${rota}`).at(-1)!.url.searchParams;
}

test.describe('Leituras brutas pela Tecsus', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    api.responder('GET /leituras-brutas', { body: pagina([umaLeituraBruta()]) });
    await page.goto('/leituras-brutas');
    await expect(page.getByRole('cell', { name: /aa:bb:cc:dd:ee:01/ })).toBeVisible();
  });

  test('filtra por licitação', async ({ page, api }) => {
    await page.getByLabel('Licitação').selectOption(LICITACAO_B.id);
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();

    await expect.poll(() => ultimaConsulta(api, '/leituras-brutas').get('licitacaoId')).toBe(LICITACAO_B.id);
  });

  test('exportar CSV exige o período', async ({ page }) => {
    const pedidos = await responderExportacao(page, '/leituras-brutas/exportar');

    await page.getByRole('button', { name: 'CSV' }).click();
    await expect(page.getByText('Informe a data inicial e a data final para exportar o CSV.')).toBeVisible();

    await page.getByLabel('Data inicial').fill(DE);
    await page.getByRole('button', { name: 'CSV' }).click();
    await expect(page.getByText('Informe a data inicial e a data final para exportar o CSV.')).toBeVisible();

    expect(pedidos).toHaveLength(0);
  });

  test('com o período, baixa o CSV gerado pela API', async ({ page }) => {
    const pedidos = await responderExportacao(page, '/leituras-brutas/exportar');

    await page.getByLabel('Licitação').selectOption(LICITACAO_A.id);
    await page.getByLabel('VID da estação').fill('ee:01');
    await page.getByLabel('Data inicial').fill(DE);
    await page.getByLabel('Data final').fill(ATE);
    await page.getByRole('button', { name: 'CSV' }).click();

    await expect.poll(() => pedidos.length).toBe(1);
    expect(Object.fromEntries(pedidos[0].searchParams)).toEqual({
      vidEstacao: 'ee:01',
      licitacaoId: LICITACAO_A.id,
      de: DE_ISO,
      ate: ATE_ISO,
    });
    // A tela continua aberta: o arquivo vai direto para o disco.
    await expect(page.getByRole('heading', { name: 'Leituras brutas', level: 1 })).toBeVisible();
  });

  test('o Excel formatado avisa quando passa de 5.000 leituras, sem baixar tudo', async ({ page, api }) => {
    api.responder('GET /leituras-brutas', ({ url }) => ({
      body: { itens: [umaLeituraBruta()], total: 6000, pagina: 1, tamanho: Number(url.searchParams.get('tamanho')) },
    }));

    await page.getByRole('button', { name: 'Excel formatado' }).click();

    await expect(page.getByText(/6\.000 leituras e o Excel formatado vai até 5\.000/)).toBeVisible();
    await expect(page.getByText(/Reduza o período ou use o CSV/)).toBeVisible();
    // Só a primeira página, para saber o total.
    const lotes = api.chamadasDe('GET /leituras-brutas').filter((chamada) => chamada.url.searchParams.get('tamanho') === '200');
    expect(lotes).toHaveLength(1);
  });
});

test.describe('Leituras brutas pelo usuário da licitação', () => {
  test('não vê o seletor de licitação', async ({ page, api }) => {
    logarComo(api, USUARIO_LICITACAO);
    api.responder('GET /leituras-brutas', { body: pagina([umaLeituraBruta()]) });
    await page.goto('/leituras-brutas');

    await expect(page.getByRole('cell', { name: /aa:bb:cc:dd:ee:01/ })).toBeVisible();
    await expect(page.getByLabel('Licitação')).toHaveCount(0);
    expect(ultimaConsulta(api, '/leituras-brutas').has('licitacaoId')).toBe(false);
  });
});

test.describe('Leituras com erro', () => {
  test('a Tecsus vê o motivo, a faixa e a licitação, e filtra', async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    api.responder('GET /leituras-erro', {
      body: pagina([
        umaLeituraErro(),
        umaLeituraErro({
          id: 'erro-2',
          vidEstacao: 'aa:bb:cc:dd:ee:99',
          nomeSensor: 'Anemometro',
          motivo: 'ESTACAO_NAO_CADASTRADA',
          parametroId: null,
          licitacaoId: null,
          valorMinimo: null,
          valorMaximo: null,
        }),
      ]),
    });
    await page.goto('/leituras-erro');

    const foraDaFaixa = page.getByRole('row', { name: /Pluviometro/ });
    await expect(foraDaFaixa).toContainText('Acima do máximo');
    await expect(foraDaFaixa).toContainText('Faixa válida: 0 a 100');
    await expect(foraDaFaixa).toContainText('PMSJC-2026');
    await expect(page.getByRole('row', { name: /Anemometro/ })).toContainText('Estação não cadastrada');

    await page.getByLabel('Motivo').selectOption('ACIMA_DO_MAXIMO');
    await page.getByLabel('Licitação').selectOption(LICITACAO_A.id);
    await page.getByLabel('VID da estação').fill('ee:01');
    await page.getByLabel('Data inicial').fill(DE);
    await page.getByLabel('Data final').fill(ATE);
    await page.getByRole('button', { name: 'Aplicar filtros' }).click();

    await expect.poll(() => api.chamadasDe('GET /leituras-erro').length).toBe(2);
    expect(Object.fromEntries(ultimaConsulta(api, '/leituras-erro'))).toEqual({
      pagina: '1',
      tamanho: '50',
      vidEstacao: 'ee:01',
      motivo: 'ACIMA_DO_MAXIMO',
      licitacaoId: LICITACAO_A.id,
      de: DE_ISO,
      ate: ATE_ISO,
    });
  });

  test('o admin da licitação não vê seletor nem coluna de licitação', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    api.responder('GET /leituras-erro', { body: pagina([umaLeituraErro()]) });
    await page.goto('/leituras-erro');

    await expect(page.getByRole('row', { name: /Pluviometro/ })).toContainText('Acima do máximo');
    await expect(page.getByLabel('Licitação')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Licitação' })).toHaveCount(0);
  });
});

test.describe('Leituras no celular', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('filtros empilham e a tabela rola sozinha', async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    api.responder('GET /leituras-brutas', { body: pagina([umaLeituraBruta()]) });
    await page.goto('/leituras-brutas');

    await expect(page.getByRole('cell', { name: /aa:bb:cc:dd:ee:01/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Excel formatado' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
