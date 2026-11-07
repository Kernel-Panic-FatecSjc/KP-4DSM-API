import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { GuardaJwt } from '../../src/autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../../src/autenticacao/guarda-perfil.guard';
import { AuditoriaService } from '../../src/auditoria/auditoria.service';
import { PrismaService } from '../../src/prisma/prisma.service';
import { EstatisticaController } from '../../src/estatistica/estatistica.controller';
import { EstatisticaService } from '../../src/estatistica/estatica.service';

describe('GET /relatorios/estatisticas com períodos múltiplos (funcional)', () => {
  let app: INestApplication;
  const registrarAuditoria = jest.fn();
  const $queryRaw = jest.fn();

  beforeAll(async () => {
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

  beforeEach(() => {
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

  afterAll(async () => app.close());

  it('calcula diferença absoluta e percentual em relação ao primeiro período', async () => {
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

    expect(resposta.body.periodos).toHaveLength(2);
    expect(resposta.body.periodos[0].estacoes[0].media).toBe(10);
    expect(resposta.body.comparacoes).toHaveLength(1);
    expect(resposta.body.comparacoes[0]).toMatchObject({
      estacaoId: 'estacao-1', periodoReferenciaIndice: 0, periodoComparadoIndice: 1,
      quantidade: { diferencaAbsoluta: 2, diferencaPercentual: 50 },
      media: { diferencaAbsoluta: 5, diferencaPercentual: 50 },
      mediana: { diferencaAbsoluta: 4, diferencaPercentual: 40 },
      desvioPadrao: { diferencaAbsoluta: 1, diferencaPercentual: 50 },
      variancia: { diferencaAbsoluta: 5, diferencaPercentual: 125 },
      quartil1: { diferencaAbsoluta: 4, diferencaPercentual: 50 },
      quartil2: { diferencaAbsoluta: 4, diferencaPercentual: 40 },
      quartil3: { diferencaAbsoluta: 5, diferencaPercentual: expect.closeTo(500 / 12, 10) },
      minimo: { diferencaAbsoluta: 4, diferencaPercentual: expect.closeTo(200 / 3, 10) },
      maximo: { diferencaAbsoluta: 6, diferencaPercentual: expect.closeTo(300 / 7, 10) },
    });
    expect(registrarAuditoria).toHaveBeenCalledTimes(1);
  });

  it('rejeita períodos inclusivos sobrepostos', async () => {
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
    expect($queryRaw).not.toHaveBeenCalled();
  });
});
