import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

const ADMIN = { id: 'admin-1', email: 'admin@teste.com', tipo: 'ADMINISTRADOR', ativo: true };
// São José dos Campos/SP
const REGIAO = 'latitude=-23.1791&longitude=-45.8872';

describe('Visualização de alertas sem login (funcional)', () => {
  let app: INestApplication;
  let adminCookie: string;
  const usuario = { findUnique: jest.fn() };
  const alerta = { findMany: jest.fn(), count: jest.fn() };
  const alarme = { findMany: jest.fn(), count: jest.fn() };
  const estacao = { findMany: jest.fn() };
  const tipoParametro = { findMany: jest.fn() };
  const parametro = { findMany: jest.fn() };
  const logAuditoria = { create: jest.fn() };
  const $queryRaw = jest.fn();

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        alerta,
        alarme,
        estacao,
        tipoParametro,
        parametro,
        logAuditoria,
        $queryRaw,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
    });

    const jwt = app.get(JwtService);
    adminCookie = `access_token=${jwt.sign({ sub: ADMIN.id, email: ADMIN.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockImplementation(({ where }) => (where.id === ADMIN.id ? ADMIN : null));
    for (const modelo of [alerta, alarme]) {
      modelo.findMany.mockResolvedValue([]);
      modelo.count.mockResolvedValue(0);
    }
    for (const modelo of [estacao, tipoParametro, parametro]) {
      modelo.findMany.mockResolvedValue([]);
    }
    $queryRaw.mockResolvedValue([{ id: 'estacao-perto' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  it.each(['/alertas', '/alertas/filtros', '/alarmes', '/alarmes/filtros'])(
    'libera GET %s para visitantes que informam a região',
    async (rota) => {
      await request(app.getHttpServer()).get(`${rota}?${REGIAO}`).expect(200);
    },
  );

  it.each(['/alertas', '/alertas/filtros', '/alarmes', '/alarmes/filtros'])(
    'exige a região do visitante em GET %s',
    async (rota) => {
      await request(app.getHttpServer()).get(rota).expect(400);
    },
  );

  it('rejeita latitude sem longitude', async () => {
    await request(app.getHttpServer()).get('/alarmes?latitude=-23.1').expect(400);
  });

  it('restringe o visitante às estações do raio', async () => {
    await request(app.getHttpServer()).get(`/alarmes?${REGIAO}`).expect(200);

    expect(alarme.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          alerta: expect.objectContaining({
            parametro: expect.objectContaining({ estacaoId: { in: ['estacao-perto'] } }),
          }),
        }),
      }),
    );
  });

  it('não mostra ao visitante uma estação fora do raio mesmo se filtrada por id', async () => {
    const foraDoRaio = '6f1c1c1e-0000-4000-8000-000000000000';
    await request(app.getHttpServer()).get(`/alertas?${REGIAO}&estacaoId=${foraDoRaio}`).expect(200);

    expect(alerta.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          parametro: expect.objectContaining({ estacaoId: { in: [] } }),
        }),
      }),
    );
  });

  it('não filtra por região quem está logado', async () => {
    await request(app.getHttpServer()).get('/alarmes').set('Cookie', adminCookie).expect(200);
    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('audita a consulta do visitante sem usuário e sem guardar a localização', async () => {
    await request(app.getHttpServer()).get(`/alertas?${REGIAO}`).expect(200);

    const registro = logAuditoria.create.mock.calls
      .map(([argumento]) => argumento.data)
      .find((data) => data.acao === 'alertas.consultar');
    expect(registro).toMatchObject({ usuarioId: undefined, detalhes: { porRegiao: true } });
    expect(registro.detalhes).not.toHaveProperty('latitude');
    expect(registro.detalhes).not.toHaveProperty('longitude');
  });

  it('continua identificando o usuário quando há sessão', async () => {
    await request(app.getHttpServer()).get('/alertas').set('Cookie', adminCookie).expect(200);

    expect(logAuditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ acao: 'alertas.consultar', usuarioId: ADMIN.id }),
      }),
    );
  });

  it('trata cookie inválido como visitante em vez de responder 401', async () => {
    await request(app.getHttpServer()).get(`/alarmes?${REGIAO}`).set('Cookie', 'access_token=invalido').expect(200);
  });

  it('mantém as demais rotas protegidas', async () => {
    await request(app.getHttpServer()).get('/estacoes').expect(401);
    await request(app.getHttpServer()).get('/dashboard').expect(401);
  });
});
