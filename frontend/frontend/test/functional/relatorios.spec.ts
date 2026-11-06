import type { EstacaoApi, DashboardDados } from '@/lib/api';
import { ADMIN, pagina } from './support/dados';
import { logarComo, test, expect } from './support/teste';

const ESTACOES: EstacaoApi[] = [
  {
    id: 'estacao-centro',
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
    id: 'estacao-norte',
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

function dashboard(estacao: EstacaoApi, leituras: { timestamp: string; valor: number }[]): DashboardDados {
  return {
    licitacaoId: null,
    periodo: { de: '2026-10-24T00:00:00.000Z', ate: '2026-10-24T23:59:59.999Z' },
    estacoes: [{ id: estacao.id, nome: estacao.nome, endereco: estacao.endereco }],
    indicadores: { estacoesAtivas: 1, leituras: leituras.length, media: null, alarmesAbertos: 0 },
    series: [{
      parametroId: `precipitacao-${estacao.id}`,
      nome: 'Precipitação',
      unidade: 'mm',
      estacaoId: estacao.id,
      estacaoNome: estacao.nome,
      pontos: leituras,
    }],
  };
}

test.describe('Relatório de histórico climático', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /estacoes', { body: pagina(ESTACOES) });
    api.responder('GET /dashboard', ({ url }) => {
      const estacao = ESTACOES.find((item) => item.id === url.searchParams.get('estacaoId'));
      if (!estacao) return { status: 400, body: { message: 'Estação inválida' } };
      return {
        body: dashboard(estacao, estacao.id === 'estacao-centro'
          ? [
              { timestamp: '2026-10-24T09:00:00.000Z', valor: 2 },
              { timestamp: '2026-10-24T10:00:00.000Z', valor: 5 },
            ]
          : [{ timestamp: '2026-10-24T11:00:00.000Z', valor: 3 }]),
      };
    });
    await page.goto('/relatorios');
  });

  test('filtra estações e apresenta precipitação diária acumulada', async ({ page, api }) => {
    await expect(page.getByRole('checkbox', { name: 'Estação Norte' })).toBeChecked();
    await page.getByLabel('Data inicial').fill('2026-10-24');
    await page.getByLabel('Data final').fill('2026-10-24');
    await page.getByLabel('Granularidade').selectOption('dia');
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    await expect(page.getByRole('table')).toContainText('Estação Centro');
    await expect(page.getByRole('table')).toContainText('5,00 mm');
    await expect(page.getByRole('table')).toContainText('3,00 mm');
    await expect(page.getByRole('table')).toContainText('Estação Norte');
    await expect(page.getByRole('img', { name: 'Gráfico de Precipitação' }).first()).toBeVisible();
    expect(api.chamadasDe('GET /dashboard')).toHaveLength(2);
    expect(api.chamadasDe('GET /dashboard').every((chamada) => chamada.url.searchParams.get('periodo') === 'customizado')).toBe(true);

    await expect(page.getByRole('button', { name: 'CSV' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'PDF' })).toBeVisible();
    await page.evaluate(() => {
      window.print = () => sessionStorage.setItem('exportacao-pdf-acionada', 'true');
      URL.createObjectURL = () => {
        sessionStorage.setItem('exportacao-csv-acionada', 'true');
        return 'blob:';
      };
    });
    await page.getByRole('button', { name: 'CSV' }).click();
    await page.getByRole('button', { name: 'PDF' }).click();
    expect(await page.evaluate(() => [
      sessionStorage.getItem('exportacao-csv-acionada'),
      sessionStorage.getItem('exportacao-pdf-acionada'),
    ])).toEqual([null, null]);
  });

  test('apresenta estado vazio quando o período não tem leituras', async ({ page, api }) => {
    api.responder('GET /dashboard', ({ url }) => {
      const estacao = ESTACOES.find((item) => item.id === url.searchParams.get('estacaoId'))!;
      return { body: dashboard(estacao, []) };
    });
    await page.getByLabel('Data inicial').fill('2026-10-24');
    await page.getByLabel('Data final').fill('2026-10-24');
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    await expect(page.getByRole('heading', { name: 'Nenhum dado encontrado' })).toBeVisible();
    await expect(page.getByRole('table')).toHaveCount(0);
  });

  test('agrupa por hora e permite selecionar estações individualmente', async ({ page }) => {
    await expect(page.getByRole('link', { name: 'Relatórios' })).toBeVisible();
    await page.getByLabel('Data inicial').fill('2026-10-24');
    await page.getByLabel('Data final').fill('2026-10-24');
    await page.getByLabel('Granularidade').selectOption('hora');
    await page.getByRole('checkbox', { name: 'Estação Norte' }).uncheck();
    await page.getByRole('button', { name: 'Gerar relatório' }).click();

    const tabela = page.getByRole('table');
    await expect(tabela.locator('tbody tr:visible')).toHaveCount(2);
    await expect(tabela).toContainText('2,00 mm');
    await expect(tabela).toContainText('5,00 mm');
    await expect(tabela).not.toContainText('Estação Norte');
  });

  test('não disponibiliza dados fictícios', async ({ page }) => {
    await expect(page.getByRole('button', { name: /dados fictícios/i })).toHaveCount(0);
    await expect(page.getByRole('checkbox', { name: /demonstração/i })).toHaveCount(0);
  });
});
