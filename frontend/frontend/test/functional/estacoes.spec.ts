import type { CriarEstacaoPayload, EstacaoApi, EstacaoCriadaApi, SensorApi } from '@/lib/api';
import type { ApiFalsa } from './support/api-falsa';
import {
  ADMIN,
  ADMIN_LICITACAO,
  ADMIN_LICITACAO_ENCERRADA,
  LICITACAO_A,
  USUARIO_LICITACAO,
  pagina,
  umaLicitacao,
} from './support/dados';
import { expect, logarComo, test } from './support/teste';

const LICITACAO_B = umaLicitacao({ id: 'licitacao-b', codigoIdentificador: 'PMTAU-2026', orgaoNome: 'Prefeitura de Taubaté' });

function resumo(licitacao: { id: string; codigoIdentificador: string }) {
  return { id: licitacao.id, codigoIdentificador: licitacao.codigoIdentificador };
}

function umaEstacao(dados: Partial<EstacaoApi> = {}): EstacaoApi {
  return {
    id: 'estacao-1',
    nome: 'Estação',
    endereco: 'Centro, São José dos Campos - SP',
    vid: 'aa:bb:cc:dd:ee:ff',
    latitude: -23.1896,
    longitude: -45.8841,
    statusOperacional: 'ATIVA',
    possuiChaveIngestao: true,
    sensores: [],
    licitacao: resumo(LICITACAO_A),
    criadoEm: '2026-09-01T12:00:00.000Z',
    atualizadoEm: '2026-09-01T12:00:00.000Z',
    ...dados,
  };
}

function umSensor(dados: Partial<SensorApi> = {}): SensorApi {
  return {
    id: 'sensor-1',
    nome: 'Sensor',
    unidade: 'mm',
    fator: 1,
    ganho: 0,
    valorMinimo: null,
    valorMaximo: null,
    estacoesAssociadas: 0,
    licitacaoId: LICITACAO_A.id,
    ...dados,
  };
}

const CENTRO = umaEstacao({ id: 'estacao-centro', nome: 'Estação Centro', vid: 'aa:bb:cc:dd:ee:01' });
const TAUBATE = umaEstacao({
  id: 'estacao-taubate',
  nome: 'Estação Taubaté',
  vid: 'aa:bb:cc:dd:ee:02',
  endereco: 'Centro, Taubaté - SP',
  licitacao: resumo(LICITACAO_B),
});

const PLUVIOMETRO = umSensor({ id: 'sensor-a', nome: 'Pluviômetro', unidade: 'mm', licitacaoId: LICITACAO_A.id });
const ANEMOMETRO = umSensor({ id: 'sensor-b', nome: 'Anemômetro', unidade: 'm/s', licitacaoId: LICITACAO_B.id });

/** GET /estacoes filtrando e paginando como a API. */
function responderEstacoes(api: ApiFalsa, estacoes: EstacaoApi[]) {
  api.responder('GET /estacoes', ({ url }) => {
    const busca = url.searchParams.get('busca')?.toLocaleLowerCase('pt-BR') ?? '';
    const licitacaoId = url.searchParams.get('licitacaoId');
    const encontradas = estacoes.filter(
      (estacao) =>
        (!busca ||
          estacao.nome.toLocaleLowerCase('pt-BR').includes(busca) ||
          estacao.vid.toLocaleLowerCase('pt-BR').includes(busca)) &&
        (!licitacaoId || estacao.licitacao.id === licitacaoId),
    );
    const numero = Number(url.searchParams.get('pagina') ?? 1);
    const tamanho = Number(url.searchParams.get('tamanho') ?? 50);
    return {
      body: { itens: encontradas.slice((numero - 1) * tamanho, numero * tamanho), total: encontradas.length, pagina: numero, tamanho },
    };
  });
}

/** GET /sensores: sem licitacaoId, os da licitação de quem está logado (LICITACAO_A). */
function responderSensores(api: ApiFalsa) {
  api.responder('GET /sensores', ({ url }) => {
    const licitacaoId = url.searchParams.get('licitacaoId') ?? LICITACAO_A.id;
    return { body: pagina([PLUVIOMETRO, ANEMOMETRO].filter((sensor) => sensor.licitacaoId === licitacaoId)) };
  });
}

function ultimaConsulta(api: ApiFalsa): URLSearchParams {
  return api.chamadasDe('GET /estacoes').at(-1)!.url.searchParams;
}

test.describe('Estações pela Tecsus', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    responderEstacoes(api, [CENTRO, TAUBATE]);
    responderSensores(api);
    await page.goto('/estacoes');
  });

  test('mostra a licitação de cada estação e filtra por ela', async ({ page, api }) => {
    await expect(page.getByRole('row', { name: /Estação Centro/ })).toContainText('PMSJC-2026');
    await expect(page.getByRole('row', { name: /Estação Taubaté/ })).toContainText('PMTAU-2026');

    await page.getByLabel('Licitação').selectOption(LICITACAO_B.id);

    await expect(page.getByRole('row', { name: /Estação Centro/ })).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Estação Taubaté/ })).toBeVisible();
    expect(ultimaConsulta(api).get('licitacaoId')).toBe(LICITACAO_B.id);
  });

  test('busca pela API', async ({ page, api }) => {
    await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();

    await page.getByLabel('Buscar estação').fill('ee:02');

    await expect(page.getByRole('row', { name: /Estação Centro/ })).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Estação Taubaté/ })).toBeVisible();
    expect(ultimaConsulta(api).get('busca')).toBe('ee:02');
  });

  test('cadastra escolhendo a licitação e os sensores dela', async ({ page, api }) => {
    api.responder('POST /estacoes', ({ corpo }) => {
      const dados = corpo as CriarEstacaoPayload;
      const criada: EstacaoCriadaApi = {
        ...umaEstacao({ id: 'estacao-nova', nome: dados.nome, vid: dados.vid, licitacao: resumo(LICITACAO_B) }),
        chaveIngestao: 'chave-secreta-123',
      };
      return { status: 201, body: criada };
    });

    await page.getByRole('button', { name: 'Nova estação' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastrar estação' });
    await cadastro.getByLabel('Licitação').selectOption(LICITACAO_B.id);
    await cadastro.getByLabel('Nome da estação').fill('Estação Nova');
    await cadastro.getByLabel('UUID/MAC').fill('aa:bb:cc:dd:ee:03');
    await cadastro.getByLabel('Latitude').fill('-23.03');
    await cadastro.getByLabel('Longitude').fill('-45.55');
    await cadastro.getByLabel('Endereço / Região').fill('Centro, Taubaté - SP');

    await cadastro.getByRole('button', { name: 'Selecionar sensores' }).click();
    const sensores = page.getByRole('dialog', { name: 'Selecionar sensores' });
    // Só os sensores da licitação escolhida.
    await expect(sensores.getByRole('button', { name: /Pluviômetro/ })).toHaveCount(0);
    await sensores.getByRole('button', { name: /Anemômetro/ }).click();
    await sensores.getByRole('button', { name: 'Confirmar' }).click();

    await cadastro.getByRole('button', { name: 'Cadastrar estação' }).click();

    await expect(page.getByRole('dialog', { name: 'Chave de ingestão' })).toContainText('chave-secreta-123');
    const consultaSensores = api.chamadasDe('GET /sensores').at(-1)!.url.searchParams;
    expect(consultaSensores.get('licitacaoId')).toBe(LICITACAO_B.id);
    expect(consultaSensores.get('tamanho')).toBe('200');
    expect(api.chamadasDe('POST /estacoes')[0].corpo).toEqual({
      nome: 'Estação Nova',
      endereco: 'Centro, Taubaté - SP',
      vid: 'aa:bb:cc:dd:ee:03',
      latitude: -23.03,
      longitude: -45.55,
      tipoParametroIds: [ANEMOMETRO.id],
      licitacaoId: LICITACAO_B.id,
    });
  });

  test('avisa que trocar o vid apaga a chave de ingestão', async ({ page, api }) => {
    api.responder('PATCH /estacoes/:id', ({ corpo }) => ({
      body: { ...CENTRO, ...(corpo as Partial<EstacaoApi>), possuiChaveIngestao: false },
    }));

    await page.getByRole('button', { name: 'Ações para Estação Centro' }).click();
    await page.getByRole('menuitem', { name: 'Editar' }).click();
    const edicao = page.getByRole('dialog', { name: 'Editar estação' });
    await expect(edicao).toContainText('PMSJC-2026');
    await expect(edicao.getByText('a chave de ingestão da estação é apagada')).toHaveCount(0);

    await edicao.getByLabel('UUID/MAC').fill('aa:bb:cc:dd:ee:09');
    await expect(edicao.getByText(/a chave de ingestão da estação é apagada/)).toBeVisible();

    page.once('dialog', (dialogo) => {
      expect(dialogo.message()).toContain('Gerar chave');
      void dialogo.accept();
    });
    await edicao.getByRole('button', { name: 'Salvar alterações' }).click();

    await expect(page.getByRole('row', { name: /aa:bb:cc:dd:ee:09/ })).toContainText('Sem chave de ingestão');
    // Os sensores oferecidos na edição são os da licitação da estação.
    expect(api.chamadasDe('GET /sensores').at(-1)!.url.searchParams.get('licitacaoId')).toBe(LICITACAO_A.id);
  });
});

test.describe('Estações com paginação pela API', () => {
  test('pede a próxima página à API', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    const estacoes = Array.from({ length: 12 }, (_, indice) =>
      umaEstacao({
        id: `estacao-${indice + 1}`,
        nome: `Estação ${String(indice + 1).padStart(2, '0')}`,
        vid: `aa:bb:cc:dd:ee:${String(indice + 10).padStart(2, '0')}`,
      }),
    );
    responderEstacoes(api, estacoes);
    await page.goto('/estacoes');

    await expect(page.getByText('Página 1 de 2')).toBeVisible();
    await expect(page.getByRole('row', { name: /Estação 11/ })).toHaveCount(0);

    await page.getByText('Página 1 de 2').locator('..').getByRole('button').last().click();

    await expect(page.getByRole('row', { name: /Estação 11/ })).toBeVisible();
    expect(ultimaConsulta(api).get('pagina')).toBe('2');
    expect(ultimaConsulta(api).get('tamanho')).toBe('10');
  });
});

test.describe('Estações pelo admin da licitação', () => {
  test('não vê o seletor de licitação e cadastra sem informá-la', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    responderEstacoes(api, [CENTRO]);
    responderSensores(api);
    api.responder('POST /estacoes', ({ corpo }) => ({
      status: 201,
      body: { ...umaEstacao({ id: 'estacao-nova', nome: (corpo as CriarEstacaoPayload).nome }), chaveIngestao: 'outra-chave' },
    }));
    await page.goto('/estacoes');

    await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();
    await expect(page.getByLabel('Licitação')).toHaveCount(0);
    await expect(page.getByRole('columnheader', { name: 'Licitação' })).toHaveCount(0);

    await page.getByRole('button', { name: 'Nova estação' }).click();
    const cadastro = page.getByRole('dialog', { name: 'Cadastrar estação' });
    await expect(cadastro.getByLabel('Licitação')).toHaveCount(0);
    await cadastro.getByLabel('Nome da estação').fill('Estação Norte');
    await cadastro.getByLabel('UUID/MAC').fill('aa:bb:cc:dd:ee:04');
    await cadastro.getByLabel('Latitude').fill('-23.1');
    await cadastro.getByLabel('Longitude').fill('-45.8');
    await cadastro.getByLabel('Endereço / Região').fill('Zona Norte, São José dos Campos - SP');
    await cadastro.getByRole('button', { name: 'Selecionar sensores' }).click();
    await page.getByRole('dialog', { name: 'Selecionar sensores' }).getByRole('button', { name: /Pluviômetro/ }).click();
    await page.getByRole('button', { name: 'Confirmar' }).click();
    await cadastro.getByRole('button', { name: 'Cadastrar estação' }).click();

    await expect(page.getByRole('dialog', { name: 'Chave de ingestão' })).toContainText('outra-chave');
    expect(api.chamadasDe('GET /sensores')[0].url.searchParams.has('licitacaoId')).toBe(false);
    const corpo = api.chamadasDe('POST /estacoes')[0].corpo as CriarEstacaoPayload;
    expect(corpo).not.toHaveProperty('licitacaoId');
    expect(corpo.tipoParametroIds).toEqual([PLUVIOMETRO.id]);
  });
});

test.describe('Estações para quem só lê', () => {
  for (const [descricao, usuario] of [
    ['usuário da licitação', USUARIO_LICITACAO],
    ['admin de licitação encerrada', ADMIN_LICITACAO_ENCERRADA],
  ] as const) {
    test(`${descricao} não vê botões de escrita`, async ({ page, api }) => {
      logarComo(api, usuario);
      responderEstacoes(api, [CENTRO]);
      await page.goto('/estacoes');

      await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Nova estação' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Ações para Estação Centro' })).toHaveCount(0);
    });
  }
});

test.describe('Estações no celular', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('a tabela rola sozinha, sem rolar a página para o lado', async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    responderEstacoes(api, [CENTRO, TAUBATE]);
    await page.goto('/estacoes');

    await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova estação' })).toBeVisible();
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(375);
  });
});
