import type { EstacaoApi, HistoricoClimatico } from '@/lib/api';
import { ADMIN, pagina } from './support/dados';
import { logarComo, test, expect } from './support/teste';

const ESTACAO_CENTRO = '11111111-1111-4111-8111-111111111111';
const ESTACAO_NORTE = '22222222-2222-4222-8222-222222222222';
const ESTACOES: EstacaoApi[] = [
  {
    id: ESTACAO_CENTRO,
    nome: 'Estação Centro',
    endereco: 'Rua A, 1',
    vid: 'VID-001',
    latitude: -23.1,
    longitude: -45.8,
    statusOperacional: 'ATIVA',
    possuiChaveIngestao: true,
    sensores: [],
    licitacao: { id: 'licitacao-a', codigoIdentificador: 'LIC-A' },
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
  },
  {
    id: ESTACAO_NORTE,
    nome: 'Estação Norte',
    endereco: 'Rua B, 2',
    vid: 'VID-002',
    latitude: -23.2,
    longitude: -45.9,
    statusOperacional: 'ATIVA',
    possuiChaveIngestao: true,
    sensores: [],
    licitacao: { id: 'licitacao-a', codigoIdentificador: 'LIC-A' },
    criadoEm: '2026-01-01T00:00:00.000Z',
    atualizadoEm: '2026-01-01T00:00:00.000Z',
  },
];

function historico(estacoes: HistoricoClimatico['estacoes']): HistoricoClimatico {
  return {
    de: '2026-10-24T00:00:00.000Z',
    ate: '2026-10-24T23:59:59.999Z',
    granularidade: 'dia',
    estacoes,
  };
}

function dadosEstacao(estacao: EstacaoApi, valores: number[]) {
  return {
    id: estacao.id,
    nome: estacao.nome,
    parametros: [{
      id: 'tipo-precipitacao',
      nome: 'Precipitação',
      unidade: 'mm',
      agregacao: 'SOMA' as const,
      periodos: valores.map((valor, indice) => ({
        periodo: `2026-10-24T${String(9 + indice).padStart(2, '0')}:00:00.000Z`,
        agregacao: 'SOMA' as const,
        valor,
        soma: valor,
        media: valor,
        minimo: valor,
        maximo: valor,
        leituras: 1,
      })),
      totalPeriodo: {
        agregacao: 'SOMA' as const,
        valor: valores.reduce((total, valor) => total + valor, 0),
        soma: valores.reduce((total, valor) => total + valor, 0),
        media: valores.length ? valores.reduce((total, valor) => total + valor, 0) / valores.length : 0,
        minimo: Math.min(...valores),
        maximo: Math.max(...valores),
        leituras: valores.length,
      },
    }],
  };
}

test.describe('Relatório de histórico climático', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /estacoes', { body: pagina(ESTACOES) });
    api.responder('GET /relatorios/historico-climatico', {
      body: historico([
        dadosEstacao(ESTACOES[0], [2, 5]),
        dadosEstacao(ESTACOES[1], [3]),
      ]),
    });
    await page.goto('/relatorios/historico');
  });

  test('consulta o endpoint consolidado e apresenta tabela e gráfico', async ({ page, api }) => {
    await expect(page.getByRole('checkbox', { name: 'Estação Norte' })).toBeChecked();
    await page.getByLabel('Data inicial').fill('2026-10-24');
    await page.getByLabel('Data final').fill('2026-10-24');
    await page.getByLabel('Granularidade').selectOption('dia');
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    const tabela = page.getByRole('table');
    await expect(tabela).toContainText('Estação Centro');
    await expect(tabela).toContainText('Estação Norte');
    await expect(tabela).toContainText('7,00 mm');
    await expect(tabela).toContainText('3,50 mm');
    await expect(tabela).toContainText('2');
    await expect(page.getByRole('img', { name: 'Gráfico de Precipitação' })).toBeVisible();

    const chamada = api.chamadasDe('GET /relatorios/historico-climatico')[0];
    expect(chamada.url.searchParams.get('de')).toBe('2026-10-24');
    expect(chamada.url.searchParams.get('ate')).toBe('2026-10-24');
    expect(chamada.url.searchParams.get('granularidade')).toBe('dia');
    expect(chamada.url.searchParams.getAll('estacaoIds')).toEqual([ESTACAO_CENTRO, ESTACAO_NORTE]);
  });

  test('envia granularidade por hora e somente as estações selecionadas', async ({ page, api }) => {
    await page.getByLabel('Data inicial').fill('2026-10-24');
    await page.getByLabel('Data final').fill('2026-10-24');
    await page.getByLabel('Granularidade').selectOption('hora');
    await page.getByRole('checkbox', { name: 'Estação Norte' }).uncheck();
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    const chamada = api.chamadasDe('GET /relatorios/historico-climatico')[0];
    expect(chamada.url.searchParams.get('granularidade')).toBe('hora');
    expect(chamada.url.searchParams.getAll('estacaoIds')).toEqual([ESTACAO_CENTRO]);
  });

  test('apresenta estado vazio quando o período não tem leituras', async ({ page, api }) => {
    api.responder('GET /relatorios/historico-climatico', { body: historico([]) });
    await page.getByLabel('Data inicial').fill('2026-10-24');
    await page.getByLabel('Data final').fill('2026-10-24');
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    await expect(page.getByRole('heading', { name: 'Nenhum dado encontrado' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('apresenta erro retornado pela API', async ({ page, api }) => {
    api.responder('GET /relatorios/historico-climatico', {
      status: 400,
      body: { message: 'Período inválido' },
    });
    await page.getByLabel('Data inicial').fill('2026-10-24');
    await page.getByLabel('Data final').fill('2026-10-24');
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText('Período inválido');
  });

  test('exige ao menos uma estação', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Nenhuma' }).click();
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    await expect(page.locator('p[role="alert"]')).toContainText('Selecione pelo menos uma estação');
    expect(api.chamadasDe('GET /relatorios/historico-climatico')).toHaveLength(0);
  });
});
