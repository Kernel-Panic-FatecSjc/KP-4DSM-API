import type { Alerta, OpcoesFiltroAlertas, Usuario } from '@/lib/api';
import {
  ADMIN,
  ADMIN_LICITACAO,
  ADMIN_LICITACAO_ENCERRADA,
  FILTROS_ALARMES,
  FILTROS_ALERTAS,
  LICITACAO_A,
  pagina,
  umaLicitacao,
  umAlarme,
  USUARIO_LICITACAO,
} from './support/dados';
import type { ApiFalsa } from './support/api-falsa';
import { expect, logarComo, test } from './support/teste';

const LICITACAO_B = umaLicitacao({ id: 'licitacao-b', codigoIdentificador: 'PMTAU-2026', orgaoNome: 'Prefeitura de Taubaté' });

const OPCOES_ALERTAS: OpcoesFiltroAlertas = {
  ...FILTROS_ALERTAS,
  parametros: [{ id: 'parametro-1', nome: 'Precipitação', unidade: 'mm', estacaoId: 'estacao-1', estacaoNome: 'Estação Centro' }],
};

let sequencia = 0;

function umAlerta(dados: Partial<Alerta> = {}): Alerta {
  sequencia += 1;
  return {
    id: `alerta-${sequencia}`,
    operador: 'MAIOR_QUE',
    valorLimite: 50,
    severidade: 'ALERTA',
    ativo: true,
    criadoEm: '2026-10-18T15:30:00.000Z',
    licitacaoId: LICITACAO_A.id,
    estacao: { id: 'estacao-1', nome: 'Estação Centro' },
    parametro: { id: 'parametro-1', nome: 'Precipitação', unidade: 'mm' },
    ...dados,
  };
}

/** Lista guardada no teste: o POST entra nela, como na API. */
function responderAlertas(api: ApiFalsa, iniciais: Alerta[] = [umAlerta()]) {
  let alertas = iniciais;
  api.responder('GET /alertas/filtros', { body: OPCOES_ALERTAS });
  api.responder('GET /alertas', () => ({ body: pagina(alertas) }));
  api.responder('POST /alertas', ({ corpo }) => {
    const criado = umAlerta({ ...(corpo as Partial<Alerta>), id: 'alerta-novo' });
    alertas = [criado, ...alertas];
    return { status: 201, body: criado };
  });
}

test.describe('Gerenciamento de alertas', () => {
  test('lista pela API e cadastra um alerta com POST /alertas', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    responderAlertas(api, [umAlerta({ estacao: { id: 'estacao-1', nome: 'Estação Centro' }, valorLimite: 80 })]);

    await page.goto('/gerenciamento-de-alertas');
    await expect(page.getByRole('row', { name: /Estação Centro/ })).toContainText('80 mm');
    // O usuário de licitação não escolhe licitação: a API filtra a dele.
    await expect(page.getByLabel('Licitação', { exact: true })).toHaveCount(0);
    expect(api.chamadasDe('GET /alertas')[0].url.searchParams.has('licitacaoId')).toBe(false);

    await page.getByRole('button', { name: 'Novo alerta' }).click();
    const dialogo = page.getByRole('dialog', { name: 'Cadastrar alerta' });
    await dialogo.getByLabel('Estação').selectOption('estacao-1');
    await dialogo.getByLabel('Parâmetro monitorado').selectOption('parametro-1');
    await dialogo.getByLabel('Condição').selectOption('MAIOR_OU_IGUAL');
    await dialogo.getByLabel('Limite').fill('30');
    await dialogo.getByLabel('Severidade').selectOption('EMERGENCIA');
    await dialogo.getByRole('button', { name: 'Salvar alerta' }).click();

    await expect(dialogo).toHaveCount(0);
    await expect(page.getByRole('row', { name: /Emergência/ })).toContainText('30 mm');
    expect(api.chamadasDe('POST /alertas')[0].corpo).toEqual({
      parametroId: 'parametro-1',
      operador: 'MAIOR_OU_IGUAL',
      valorLimite: 30,
      severidade: 'EMERGENCIA',
    });
  });

  test('a Tecsus filtra por licitação', async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    responderAlertas(api);

    await page.goto('/gerenciamento-de-alertas');
    await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Novo alerta' })).toBeVisible();

    await page.getByLabel('Licitação', { exact: true }).selectOption(LICITACAO_B.id);

    await expect.poll(() => api.chamadasDe('GET /alertas').at(-1)?.url.searchParams.get('licitacaoId')).toBe(LICITACAO_B.id);
    await expect
      .poll(() => api.chamadasDe('GET /alertas/filtros').at(-1)?.url.searchParams.get('licitacaoId'))
      .toBe(LICITACAO_B.id);
  });

  const SO_LEITURA: [string, Usuario][] = [
    ['usuário comum', USUARIO_LICITACAO],
    ['admin de licitação encerrada', ADMIN_LICITACAO_ENCERRADA],
  ];

  for (const [descricao, usuario] of SO_LEITURA) {
    test(`${descricao} só consulta, sem ações de cadastro`, async ({ page, api }) => {
      logarComo(api, usuario);
      responderAlertas(api);

      await page.goto('/gerenciamento-de-alertas');

      await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();
      await expect(page.getByRole('button', { name: 'Novo alerta' })).toHaveCount(0);
      await expect(page.getByRole('button', { name: /Editar alerta/ })).toHaveCount(0);
      await expect(page.getByRole('columnheader', { name: 'Ações' })).toHaveCount(0);
    });
  }
});

test.describe('/alertas', () => {
  test('redireciona para o gerenciamento de alertas', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    responderAlertas(api);

    await page.goto('/alertas');

    await expect(page).toHaveURL('/gerenciamento-de-alertas');
    await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();
  });
});

test.describe('Alertas globais com login', () => {
  function responderConsulta(api: ApiFalsa) {
    api
      .responder('GET /alarmes/filtros', { body: FILTROS_ALARMES })
      .responder('GET /alarmes', { body: pagina([umAlarme({ status: 'ABERTO' })]) })
      .responder('GET /alertas/filtros', { body: FILTROS_ALERTAS })
      .responder('GET /alertas', { body: pagina([umAlerta()]) });
  }

  test('é só leitura, mesmo para quem pode operar', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    responderConsulta(api);

    await page.goto('/alertas-globais');
    const ocorrencia = page.getByRole('button', { name: 'Ver detalhes da ocorrência em Estação Centro' });
    await expect(ocorrencia).toBeVisible();
    await expect(page.getByText('1 alerta(s) configurado(s)')).toBeVisible();

    const conteudo = page.locator('main');
    for (const acao of [/Reconhecer/, /Resolver/, /Editar/, /Novo alerta/, /Inativar/, /Excluir/]) {
      await expect(conteudo.getByRole('button', { name: acao })).toHaveCount(0);
    }
    await expect(page.getByLabel('Licitação', { exact: true })).toHaveCount(0);

    await ocorrencia.click();
    const detalhe = page.getByRole('dialog', { name: 'Estação Centro' });
    await expect(detalhe).toBeVisible();
    // No detalhe, o único botão é o de fechar.
    await expect(detalhe.getByRole('button')).toHaveCount(1);
    await expect(detalhe.getByRole('button', { name: 'Fechar detalhes da ocorrência' })).toBeVisible();

    const escritas = api.chamadas.filter((chamada) => !chamada.rota.startsWith('GET '));
    expect(escritas).toEqual([]);
    // Logado, a API filtra pela licitação: nada de região na query.
    expect(api.chamadasDe('GET /alarmes')[0].url.searchParams.has('latitude')).toBe(false);
  });

  test('a Tecsus pode filtrar por licitação', async ({ page, api }) => {
    logarComo(api, ADMIN);
    api.responder('GET /licitacoes', { body: pagina([LICITACAO_A, LICITACAO_B]) });
    responderConsulta(api);

    await page.goto('/alertas-globais');
    await expect(page.getByRole('button', { name: 'Ver detalhes da ocorrência em Estação Centro' })).toBeVisible();

    await page.getByLabel('Licitação', { exact: true }).selectOption(LICITACAO_A.id);

    for (const rota of ['GET /alarmes', 'GET /alarmes/filtros', 'GET /alertas', 'GET /alertas/filtros'] as const) {
      await expect.poll(() => api.chamadasDe(rota).at(-1)?.url.searchParams.get('licitacaoId'), rota).toBe(LICITACAO_A.id);
    }
  });
});

test.describe('Gerenciamento de alertas no celular', () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test('cabe em 375 px: a tabela rola dentro dela', async ({ page, api }) => {
    logarComo(api, ADMIN_LICITACAO);
    responderAlertas(api);

    await page.goto('/gerenciamento-de-alertas');
    await expect(page.getByRole('row', { name: /Estação Centro/ })).toBeVisible();

    const conteudo = page.locator('main');
    expect(await conteudo.evaluate((main) => main.scrollWidth - main.clientWidth)).toBeLessThanOrEqual(0);
  });
});
