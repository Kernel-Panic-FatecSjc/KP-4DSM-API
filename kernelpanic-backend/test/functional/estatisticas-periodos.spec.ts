import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GuardaJwt } from '../../src/autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../../src/autenticacao/guarda-perfil.guard';
import { AuditoriaService } from '../../src/auditoria/auditoria.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EstatisticaController } from '../../src/estatistica/estatistica.controller';
import { EstatisticaService } from '../../src/estatistica/estatica.service';
import {
  afterAll as jestAfterAll,
  beforeAll as jestBeforeAll,
  beforeEach as jestBeforeEach,
  describe as jestDescribe,
  expect as jestExpect,
  it as jestIt,
  jest,
} from '@jest/globals';

jestDescribe('GET /relatorios/estatisticas com períodos múltiplos (funcional)', () => {
  let app: INestApplication;
  const registrarAuditoria = jest.fn<() => Promise<void>>();
  const $queryRaw = jest.fn<() => Promise<unknown[]>>();

  jestBeforeAll(async () => {
    const modulo = await Test.createTestingModule({
      controllers: [EstatisticaController],
      providers: [
        EstatisticaService,
        { provide: PrismaService, useValue: { $queryRaw } },
        { provide: AuditoriaService, useValue: { registrar: registrarAuditoria } },
      ],
    })
      .overrideGuard(GuardaJwt)
      .useValue({
        canActivate: (context: { switchToHttp: () => { getRequest: () => { user?: unknown } } }) => {
          context.switchToHttp().getRequest().user = {
            sub: 'usuario-tecsus', email: 'tecsus@teste.com', tipo: 'ADMIN_TECSUS', licitacaoId: null,
            somenteLeitura: false,
          };
          return true;
        },
      })
      .overrideGuard(GuardaPerfil)
      .useValue({ canActivate: () => true })
      .compile();
    app = modulo.createNestApplication();
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();
  });

  jestBeforeEach(() => {
    jest.clearAllMocks();
    $queryRaw
      .mockResolvedValueOnce([{
        estacaoId: 'estacao-1', estacaoNome: 'Estação Centro', quantidade: 4n,
        media: 10, mediana: 10, desvioPadrao: 2, variancia: 4,
        quartil1: 8, quartil2: 10, quartil3: 12, minimo: 6, maximo: 14,
      }])
      .mockResolvedValueOnce([{
        estacaoId: 'estacao-1', estacaoNome: 'Estação Centro', quantidade: 6n,
        media: 15, mediana: 14, desvioPadrao: 3, variancia: 9,
        quartil1: 12, quartil2: 14, quartil3: 17, minimo: 10, maximo: 20,
      }]);
  });

  jestAfterAll(async () => app.close());

  jestIt('calcula diferença absoluta e percentual em relação ao primeiro período', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/relatorios/estatisticas')
      .query({
        estacaoIds: ['estacao-1'],
        parametroId: 'chuva',
        periodos: [
          '2025-01-01T00:00:00.000Z|2025-01-31T23:59:59.000Z',
          '2026-01-01T00:00:00.000Z|2026-01-31T23:59:59.000Z',
        ],
      });
    if (resposta.status !== 200) throw new Error(JSON.stringify(resposta.body));

    jestExpect(resposta.body.periodos).toHaveLength(2);
    jestExpect(resposta.body.periodos[0].estacoes[0].media).toBe(10);
    jestExpect(resposta.body.comparacoes).toHaveLength(1);
    jestExpect(resposta.body.comparacoes[0]).toMatchObject({
      estacaoId: 'estacao-1', periodoReferenciaIndice: 0, periodoComparadoIndice: 1,
      quantidade: { diferencaAbsoluta: 2, diferencaPercentual: 50 },
      media: { diferencaAbsoluta: 5, diferencaPercentual: 50 },
      mediana: { diferencaAbsoluta: 4, diferencaPercentual: 40 },
      desvioPadrao: { diferencaAbsoluta: 1, diferencaPercentual: 50 },
      variancia: { diferencaAbsoluta: 5, diferencaPercentual: 125 },
      quartil1: { diferencaAbsoluta: 4, diferencaPercentual: 50 },
      quartil2: { diferencaAbsoluta: 4, diferencaPercentual: 40 },
      quartil3: { diferencaAbsoluta: 5, diferencaPercentual: jestExpect.closeTo(500 / 12, 10) },
      minimo: { diferencaAbsoluta: 4, diferencaPercentual: jestExpect.closeTo(200 / 3, 10) },
      maximo: { diferencaAbsoluta: 6, diferencaPercentual: jestExpect.closeTo(300 / 7, 10) },
    });
    jestExpect(registrarAuditoria).toHaveBeenCalledTimes(1);
  });

  jestIt('rejeita períodos inclusivos sobrepostos', async () => {
    await request(app.getHttpServer())
      .get('/relatorios/estatisticas')
      .query({
        estacaoIds: ['estacao-1'], parametroId: 'chuva',
        periodos: [
          '2026-01-01T00:00:00.000Z|2026-01-15T00:00:00.000Z',
          '2026-01-15T00:00:00.000Z|2026-01-31T00:00:00.000Z',
        ],
      })
      .expect(400);
    jestExpect($queryRaw).not.toHaveBeenCalled();
  });

  jestIt('classifies stations more than 2 units from the group median', async () => {
    $queryRaw.mockReset().mockResolvedValueOnce([
      { estacaoId: 'e1', estacaoNome: 'Baixa', quantidade: 1n, media: 10, mediana: 10, desvioPadrao: 0, variancia: 0, quartil1: 10, quartil2: 10, quartil3: 10, minimo: 10, maximo: 10 },
      { estacaoId: 'e2', estacaoNome: 'Limite inferior', quantidade: 1n, media: 11, mediana: 11, desvioPadrao: 0, variancia: 0, quartil1: 11, quartil2: 11, quartil3: 11, minimo: 11, maximo: 11 },
      { estacaoId: 'e3', estacaoNome: 'Centro A', quantidade: 1n, media: 12, mediana: 12, desvioPadrao: 0, variancia: 0, quartil1: 12, quartil2: 12, quartil3: 12, minimo: 12, maximo: 12 },
      { estacaoId: 'e4', estacaoNome: 'Centro B', quantidade: 1n, media: 14, mediana: 14, desvioPadrao: 0, variancia: 0, quartil1: 14, quartil2: 14, quartil3: 14, minimo: 14, maximo: 14 },
      { estacaoId: 'e5', estacaoNome: 'Limite superior', quantidade: 1n, media: 15, mediana: 15, desvioPadrao: 0, variancia: 0, quartil1: 15, quartil2: 15, quartil3: 15, minimo: 15, maximo: 15 },
      { estacaoId: 'e6', estacaoNome: 'Alta', quantidade: 1n, media: 30, mediana: 30, desvioPadrao: 0, variancia: 0, quartil1: 30, quartil2: 30, quartil3: 30, minimo: 30, maximo: 30 },
    ]).mockResolvedValueOnce([
      { estacaoId: 'e1', estacaoNome: 'Baixa', quantidade: 1n, media: 20, mediana: 20, desvioPadrao: 0, variancia: 0, quartil1: 20, quartil2: 20, quartil3: 20, minimo: 20, maximo: 20 },
      { estacaoId: 'e2', estacaoNome: 'Limite inferior', quantidade: 1n, media: 20, mediana: 20, desvioPadrao: 0, variancia: 0, quartil1: 20, quartil2: 20, quartil3: 20, minimo: 20, maximo: 20 },
      { estacaoId: 'e3', estacaoNome: 'Centro A', quantidade: 1n, media: 20, mediana: 20, desvioPadrao: 0, variancia: 0, quartil1: 20, quartil2: 20, quartil3: 20, minimo: 20, maximo: 20 },
      { estacaoId: 'e4', estacaoNome: 'Centro B', quantidade: 1n, media: 20, mediana: 20, desvioPadrao: 0, variancia: 0, quartil1: 20, quartil2: 20, quartil3: 20, minimo: 20, maximo: 20 },
      { estacaoId: 'e5', estacaoNome: 'Limite superior', quantidade: 1n, media: 20, mediana: 20, desvioPadrao: 0, variancia: 0, quartil1: 20, quartil2: 20, quartil3: 20, minimo: 20, maximo: 20 },
      { estacaoId: 'e6', estacaoNome: 'Alta', quantidade: 1n, media: 20, mediana: 20, desvioPadrao: 0, variancia: 0, quartil1: 20, quartil2: 20, quartil3: 20, minimo: 20, maximo: 20 },
    ]);
    const resposta = await request(app.getHttpServer()).get('/relatorios/estatisticas').query({
      estacaoIds: ['e1', 'e2', 'e3', 'e4', 'e5', 'e6'], parametroId: 'chuva',
      periodos: [
        '2026-01-01T00:00:00.000Z|2026-01-31T23:59:59.000Z',
        '2026-02-01T00:00:00.000Z|2026-02-28T23:59:59.000Z',
      ],
    });
    if (resposta.status !== 200) throw new Error(JSON.stringify(resposta.body));
    jestExpect(resposta.body.microclimasRisco).toEqual([
      { periodoIndice: 0, estacaoId: 'e1', estacaoNome: 'Baixa', media: 10, medianaGrupo: 13, diferencaParaMediana: -3 },
      { periodoIndice: 0, estacaoId: 'e6', estacaoNome: 'Alta', media: 30, medianaGrupo: 13, diferencaParaMediana: 17 },
    ]);
  });
});

