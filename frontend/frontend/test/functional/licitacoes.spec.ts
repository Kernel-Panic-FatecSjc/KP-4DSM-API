import type { EstacaoApi, LicitacaoApi, LicitacaoPayload } from '@/lib/api';
import { ADMIN, ADMIN_LICITACAO, LICITACAO_A, pagina, umaLicitacao } from './support/dados';
import { expect, logarComo, test } from './support/teste';

const LICITACAO_B = umaLicitacao({
  id: 'licitacao-b',
  codigoIdentificador: 'CPTEC-2025',
  orgaoNome: 'Defesa Civil de Cachoeira Paulista',
  quantidadeEstacoes: 1,
});

function umaEstacao(dados: Partial<EstacaoApi> = {}): EstacaoApi {
  return {
    id: 'estacao-1',
    nome: 'Estação Centro',
    endereco: 'Praça Central, 1',
    vid: 'VID-001',
    latitude: -23.18,
    longitude: -45.88,
    statusOperacional: 'ATIVA',
    possuiChaveIngestao: true,
    sensores: [{ id: 'parametro-1', nome: 'Precipitação', unidade: 'mm' }],
    licitacao: { id: LICITACAO_A.id, codigoIdentificador: LICITACAO_A.codigoIdentificador },
    criadoEm: '2026-09-01T12:00:00.000Z',
    atualizadoEm: '2026-09-01T12:00:00.000Z',
    ...dados,
  };
}

const ESTACAO_A = umaEstacao();
const ESTACAO_B = umaEstacao({
  id: 'estacao-2',
  nome: 'Estação Rio Paraíba',
  vid: 'VID-002',
  sensores: [{ id: 'parametro-2', nome: 'Nível do rio', unidade: 'm' }],
  licitacao: { id: LICITACAO_B.id, codigoIdentificador: LICITACAO_B.codigoIdentificador },
});

test.describe('Licitações (Tecsus)', () => {
  test.beforeEach(async ({ page, api }) => {
    logarComo(api, ADMIN);
    let licitacoes: LicitacaoApi[] = [{ ...LICITACAO_A, quantidadeEstacoes: 1, quantidadeUsuarios: 3 }, LICITACAO_B];

    api.responder('GET /licitacoes', ({ url }) => {
      const status = url.searchParams.get('status');
      const esfera = url.searchParams.get('esfera');
      return {
        body: pagina(
          licitacoes.filter(
            (licitacao) => (!status || licitacao.status === status) && (!esfera || licitacao.orgaoEsfera === esfera),
          ),
        ),
      };
    });
    api.responder('POST /licitacoes', ({ corpo }) => {
      const criada = umaLicitacao({ id: 'licitacao-nova', ...(corpo as LicitacaoPayload) });
      licitacoes = [criada, ...licitacoes];
      return { status: 201, body: criada };
    });
    api.responder('PATCH /licitacoes/:id/encerrar', ({ params }) => {
      licitacoes = licitacoes.map((licitacao) =>
        licitacao.id === params.id ? { ...licitacao, status: 'ENCERRADA', encerradaEm: '2026-10-24T12:00:00.000Z' } : licitacao,
      );
      return { body: licitacoes.find((licitacao) => licitacao.id === params.id) };
    });

    await page.goto('/licitacoes');
    await expect(page.getByRole('row', { name: /PMSJC-2026/ })).toBeVisible();
  });

  test('lista as licitações com órgão, contrato e status e filtra por status e esfera', async ({ page, api }) => {
    const linha = page.getByRole('row', { name: /PMSJC-2026/ });
    await expect(linha).toContainText('Prefeitura de São José dos Campos');
    await expect(linha).toContainText('11.222.333/0001-81');
    await expect(linha).toContainText('Vigente');
    await expect(linha).toContainText('1 / 3');
    await expect(page.getByRole('row', { name: /CPTEC-2025/ })).toBeVisible();

    await page.getByLabel('Status', { exact: true }).selectOption('SUSPENSA');
    await page.getByLabel('Esfera', { exact: true }).selectOption('ESTADUAL');
    await expect(page.getByText('Nenhum registro encontrado')).toBeVisible();
    await expect
      .poll(() => api.chamadasDe('GET /licitacoes').at(-1)?.url.searchParams.toString())
      .toBe('pagina=1&tamanho=10&status=SUSPENSA&esfera=ESTADUAL');
  });

  test('cadastra uma licitação com o contrato e o órgão', async ({ page, api }) => {
    await page.getByRole('button', { name: 'Nova licitação' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cadastrar licitação' });

    await dialogo.getByLabel('Código identificador').fill('ubt-2027');
    await dialogo.getByLabel('Número do processo').fill('0456/2026');
    await dialogo.getByLabel('Modalidade').selectOption('CONCORRENCIA');
    await dialogo.getByLabel('Objeto').fill('Monitoramento do rio Paraíba');
    await dialogo.getByLabel('Número do contrato').fill('CTR-2027-001');
    await dialogo.getByLabel('Início da vigência').fill('2026-11-01');
    await dialogo.getByLabel('Fim da vigência').fill('2027-10-31');
    await dialogo.getByLabel('Nome do órgão').fill('Prefeitura de Ubatuba');
    await dialogo.getByLabel('CNPJ (opcional)').fill('11222333000180');
    await dialogo.getByLabel('Esfera').selectOption('MUNICIPAL');
    await dialogo.getByLabel('Município').fill('Ubatuba');
    await dialogo.getByLabel('UF', { exact: true }).fill('sp');

    // CNPJ com dígito verificador errado não chega na API.
    await dialogo.getByRole('button', { name: 'Cadastrar licitação' }).click();
    await expect(dialogo.getByRole('alert')).toContainText('Informe um CNPJ válido');
    expect(api.chamadasDe('POST /licitacoes')).toHaveLength(0);

    await dialogo.getByLabel('CNPJ (opcional)').fill('11222333000181');
    await expect(dialogo.getByLabel('CNPJ (opcional)')).toHaveValue('11.222.333/0001-81');
    await dialogo.getByRole('button', { name: 'Cadastrar licitação' }).click();
    await expect(dialogo).toHaveCount(0);

    expect(api.chamadasDe('POST /licitacoes')[0].corpo).toEqual({
      codigoIdentificador: 'UBT-2027',
      numeroProcesso: '0456/2026',
      modalidade: 'CONCORRENCIA',
      objeto: 'Monitoramento do rio Paraíba',
      numeroContrato: 'CTR-2027-001',
      inicioVigencia: '2026-11-01',
      fimVigencia: '2027-10-31',
      status: 'RASCUNHO',
      orgaoNome: 'Prefeitura de Ubatuba',
      orgaoCnpj: '11222333000181',
      orgaoEsfera: 'MUNICIPAL',
      orgaoMunicipio: 'Ubatuba',
      orgaoUf: 'SP',
    });
    await expect(page.getByRole('row', { name: /UBT-2027/ })).toBeVisible();
  });

  test('mostra o erro da API ao cadastrar código repetido', async ({ page, api }) => {
    api.responder('POST /licitacoes', {
      status: 409,
      body: { statusCode: 409, message: 'Já existe uma licitação com este código' },
    });

    await page.getByRole('button', { name: 'Nova licitação' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cadastrar licitação' });
    await dialogo.getByLabel('Código identificador').fill('PMSJC-2026');
    await dialogo.getByLabel('Número do processo').fill('0001/2026');
    await dialogo.getByLabel('Objeto').fill('Duplicada');
    await dialogo.getByLabel('Número do contrato').fill('CTR-X');
    await dialogo.getByLabel('Início da vigência').fill('2026-11-01');
    await dialogo.getByLabel('Fim da vigência').fill('2027-10-31');
    await dialogo.getByLabel('Nome do órgão').fill('Prefeitura');
    await dialogo.getByLabel('Município').fill('São José dos Campos');
    await dialogo.getByLabel('UF', { exact: true }).fill('SP');
    await dialogo.getByRole('button', { name: 'Cadastrar licitação' }).click();

    await expect(dialogo.getByRole('alert')).toHaveText('Já existe uma licitação com este código');
  });

  test('encerra a licitação depois de explicar o que acontece', async ({ page, api }) => {
    const linha = page.getByRole('row', { name: /PMSJC-2026/ });
    await linha.getByRole('button', { name: 'Encerrar' }).click();

    const confirmacao = page.getByRole('alertdialog', { name: 'Encerrar licitação?' });
    await expect(confirmacao).toContainText('1 estação fica inativa');
    await expect(confirmacao).toContainText('3 usuários continuam entrando, mas só para ler');
    expect(api.chamadasDe('PATCH /licitacoes/:id/encerrar')).toHaveLength(0);

    await confirmacao.getByRole('button', { name: 'Encerrar licitação' }).click();
    await expect(confirmacao).toHaveCount(0);
    expect(api.chamadasDe('PATCH /licitacoes/:id/encerrar')[0].params).toEqual({ id: LICITACAO_A.id });

    // Encerrada é imutável: some editar e encerrar.
    await expect(linha).toContainText('Encerrada');
    await expect(linha.getByRole('button', { name: 'Editar' })).toHaveCount(0);
    await expect(linha.getByRole('button', { name: 'Encerrar' })).toHaveCount(0);
  });

  test('transfere estação de outra licitação e mostra o erro de sensor faltando', async ({ page, api }) => {
    let vinculadas = [ESTACAO_A];
    api.responder('GET /licitacoes/:id/estacoes', { body: vinculadas });
    api.responder('GET /estacoes', { body: pagina([ESTACAO_A, ESTACAO_B]) });
    api.responder('POST /licitacoes/:id/estacoes', {
      status: 400,
      body: { statusCode: 400, message: 'Cadastre na licitação de destino os sensores usados pelas estações: Nível do rio' },
    });

    await page.getByRole('row', { name: /PMSJC-2026/ }).getByRole('button', { name: 'Estações' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Estações de PMSJC-2026' });
    await expect(dialogo.getByRole('list', { name: 'Estações vinculadas' })).toContainText('Estação Centro');
    await expect(dialogo.getByRole('note')).toContainText('os alertas dela na origem são inativados');

    // A estação que já é desta licitação não aparece para vincular.
    const candidatas = dialogo.getByRole('list', { name: 'Estações para vincular' });
    await expect(candidatas.getByRole('checkbox')).toHaveCount(1);
    await expect(candidatas).toContainText('vem de CPTEC-2025');

    await candidatas.getByRole('checkbox', { name: /Estação Rio Paraíba/ }).check();
    await dialogo.getByRole('button', { name: 'Vincular 1 estação' }).click();
    await expect(dialogo.getByRole('alert')).toHaveText(
      'Cadastre na licitação de destino os sensores usados pelas estações: Nível do rio',
    );
    expect(api.chamadasDe('POST /licitacoes/:id/estacoes')[0].corpo).toEqual({ estacaoIds: ['estacao-2'] });

    vinculadas = [ESTACAO_A, { ...ESTACAO_B, licitacao: { id: LICITACAO_A.id, codigoIdentificador: 'PMSJC-2026' } }];
    api.responder('GET /licitacoes/:id/estacoes', { body: vinculadas });
    api.responder('GET /estacoes', { body: pagina(vinculadas) });
    api.responder('POST /licitacoes/:id/estacoes', {
      status: 201,
      body: { licitacaoId: LICITACAO_A.id, estacoesVinculadas: 1, alertasInativados: 2 },
    });
    await dialogo.getByRole('button', { name: 'Vincular 1 estação' }).click();

    await expect(dialogo.getByRole('status')).toHaveText('1 estação vinculada; 2 alertas da origem inativados.');
    await expect(dialogo.getByRole('list', { name: 'Estações vinculadas' })).toContainText('Estação Rio Paraíba');
    await expect(dialogo.getByText('Nenhuma estação de outra licitação encontrada.')).toBeVisible();
  });
});

test.describe('Licitações fora da Tecsus', () => {
  test('o admin da licitação não vê a tela nem o item no menu', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);

    await page.goto('/licitacoes');

    await expect(page.getByText('Esta página está disponível somente para a Tecsus.')).toBeVisible();
    await expect(page.getByRole('button', { name: 'Nova licitação' })).toHaveCount(0);
    const menu = page.getByRole('complementary', { name: 'Navegação principal' });
    await menu.getByRole('button', { name: 'Administração' }).click();
    await expect(menu.getByRole('link', { name: 'Usuários' })).toBeVisible();
    await expect(menu.getByRole('link', { name: 'Licitações' })).toHaveCount(0);
    expect(api.chamadasDe('GET /licitacoes')).toHaveLength(0);
  });
});

// Página de detalhe trazida do PR #76 (detalhe do contrato), no modelo por licitação.
test.describe('Detalhe da licitação', () => {
  test('a Tecsus abre pelo código, vê contrato, órgão, estações e sensores, e vincula estação de outra licitação', async ({
    page,
    api,
  }) => {
    logarComo(api, ADMIN);
    api
      .responder('GET /licitacoes', { body: pagina([LICITACAO_A]) })
      .responder('GET /licitacoes/:id', { body: LICITACAO_A })
      .responder('GET /licitacoes/:id/estacoes', { body: [ESTACAO_A] })
      .responder('GET /estacoes', { body: pagina([ESTACAO_A, ESTACAO_B]) })
      .responder('POST /licitacoes/:id/estacoes', {
        status: 201,
        body: { licitacaoId: LICITACAO_A.id, estacoesVinculadas: 1, alertasInativados: 2 },
      });

    await page.goto('/licitacoes');
    await page.getByRole('link', { name: LICITACAO_A.codigoIdentificador }).click();

    await expect(page).toHaveURL(`/licitacoes/${LICITACAO_A.id}`);
    await expect(page.getByRole('heading', { name: `Licitação ${LICITACAO_A.codigoIdentificador}` })).toBeVisible();
    await expect(page.getByText(LICITACAO_A.orgaoNome)).toBeVisible();
    await expect(page.getByText('11.222.333/0001-81')).toBeVisible();

    await page.getByRole('button', { name: /Estação Centro/ }).click();
    await expect(page.getByText('Precipitação')).toBeVisible();

    // A estação que já é desta licitação não aparece para vincular.
    await expect(page.getByRole('checkbox')).toHaveCount(1);
    await page.getByRole('checkbox').check();
    await page.getByRole('button', { name: 'Vincular selecionadas' }).click();

    await expect(page.getByRole('status').filter({ hasText: '1 estação(ões) vinculada(s); 2 alerta(s)' })).toBeVisible();
    expect(api.chamadasDe('POST /licitacoes/:id/estacoes')[0].corpo).toEqual({ estacaoIds: [ESTACAO_B.id] });
  });

  test('o admin da licitação chega pelo cabeçalho, lê o detalhe e não vê o vínculo de estações', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    api
      .responder('GET /dashboard', {
        body: {
          licitacaoId: LICITACAO_A.id,
          periodo: { de: '2026-10-23T00:00:00.000Z', ate: '2026-10-24T00:00:00.000Z' },
          estacoes: [],
          indicadores: { estacoesAtivas: 0, leituras: 0, media: null, alarmesAbertos: 0 },
          series: [],
        },
      })
      .responder('GET /licitacoes/:id', { body: LICITACAO_A })
      .responder('GET /licitacoes/:id/estacoes', { body: [ESTACAO_A] });

    await page.goto('/dashboard');
    await page.getByRole('link', { name: LICITACAO_A.codigoIdentificador }).click();

    await expect(page.getByRole('heading', { name: `Licitação ${LICITACAO_A.codigoIdentificador}` })).toBeVisible();
    await expect(page.getByText('Estação Centro')).toBeVisible();
    await expect(page.getByRole('heading', { name: 'Vincular estações' })).toHaveCount(0);
  });
});
