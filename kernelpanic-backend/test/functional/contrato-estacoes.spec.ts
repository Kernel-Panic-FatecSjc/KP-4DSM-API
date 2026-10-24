import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ESTACAO_COM_SENSORES } from '../fixtures';
import { criarAppDeTeste } from '../helpers';

const ADMIN = {
  id: 'admin-1',
  email: 'admin@teste.com',
  tipo: 'ADMINISTRADOR',
  ativo: true,
};
const MONITOR = {
  id: 'monitor-1',
  email: 'monitor@teste.com',
  tipo: 'MONITOR',
  ativo: true,
};
const CONTRATO_ID = 'contrato-1';
const UUID_CONTRATO = '5705ca34-b812-41ed-a05f-3245b2e8ffa4';
const ESTACAO_ID = 'estacao-1';
const UUID_ESTACAO = '8f413d4e-9da5-4f0c-b26d-039f13e87c21';

describe('Hierarquia de contrato, estações e sensores (funcional)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let monitorCookie: string;
  const usuario = { findUnique: jest.fn() };
  const contrato = { findUnique: jest.fn() };
  const estacao = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    updateMany: jest.fn(),
  };
  const logAuditoria = { create: jest.fn() };
  const transacao = jest.fn();
  const prismaMock = {
    usuario,
    contrato,
    estacao,
    logAuditoria,
    $connect: jest.fn(),
    $disconnect: jest.fn(),
    $transaction: transacao,
  };

  beforeAll(async () => {
    transacao.mockImplementation((operacao) => operacao(prismaMock));
    app = await criarAppDeTeste({ prismaMock });
    const jwt = app.get(JwtService);
    adminCookie = `access_token=${jwt.sign({ sub: ADMIN.id, email: ADMIN.email })}`;
    monitorCookie = `access_token=${jwt.sign({ sub: MONITOR.id, email: MONITOR.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockImplementation(
      ({ where }) =>
        [ADMIN, MONITOR].find((user) => user.id === where.id) ?? null,
    );
    contrato.findUnique.mockResolvedValue({
      id: CONTRATO_ID,
      status: 'VIGENTE',
    });
    estacao.findMany.mockResolvedValue([ESTACAO_COM_SENSORES]);
    estacao.findUnique.mockResolvedValue({
      id: ESTACAO_ID,
      contratoId: CONTRATO_ID,
    });
    estacao.updateMany.mockResolvedValue({ count: 1 });
  });

  afterAll(async () => app.close());

  it('retorna estações e sensores vinculados, ordenados, com o contrato, sem auditoria duplicada do GET', async () => {
    const resposta = await request(app.getHttpServer())
      .get(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .expect(200);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0]).toMatchObject({
      id: ESTACAO_COM_SENSORES.id,
      sensores: [{ nome: 'Pluviômetro', unidade: 'mm' }],
      contrato: null,
    });
    expect(estacao.findMany).toHaveBeenCalledWith({
      where: { contratoId: CONTRATO_ID },
      include: expect.objectContaining({
        contrato: { select: { id: true, numero: true } },
      }),
      orderBy: { nome: 'asc' },
    });
    expect(logAuditoria.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ acao: 'contratos.estacoes.consultar' }),
    });
  });

  it('filtra GET /estacoes por contratoId e rejeita id inválido', async () => {
    await request(app.getHttpServer())
      .get(`/estacoes?contratoId=${UUID_CONTRATO}`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(estacao.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ contratoId: UUID_CONTRATO }),
      }),
    );

    await request(app.getHttpServer())
      .get('/estacoes?contratoId=nao-e-uuid')
      .set('Cookie', adminCookie)
      .expect(400);
  });

  it('retorna lista vazia para contrato sem estações', async () => {
    estacao.findMany.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect([]);
  });

  it('retorna 404 se o contrato não existe sem consultar estações ou auditar', async () => {
    contrato.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .expect(404);
    expect(estacao.findMany).not.toHaveBeenCalled();
    expect(logAuditoria.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ acao: 'contratos.estacoes.consultar' }),
    });
  });

  it('exige autenticação para consultar, vincular e desvincular e documenta a rota no Swagger', async () => {
    await request(app.getHttpServer())
      .get(`/contratos/${CONTRATO_ID}/estacoes`)
      .expect(401);

    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(401);

    await request(app.getHttpServer())
      .delete(`/contratos/${CONTRATO_ID}/estacoes/${UUID_ESTACAO}`)
      .expect(401);

    const swagger = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(swagger.body.paths['/contratos/{id}/estacoes']).toHaveProperty(
      'get',
    );
    expect(swagger.body.paths['/contratos/{id}/estacoes']).toHaveProperty(
      'post',
    );
    expect(
      swagger.body.paths['/contratos/{id}/estacoes/{estacaoId}'],
    ).toHaveProperty('delete');
  });

  it('vincula estações ativas a contrato vigente e registra auditoria', async () => {
    estacao.findMany.mockResolvedValue([
      { id: ESTACAO_ID, statusOperacional: 'ATIVA', contratoId: null },
    ]);

    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(201)
      .expect({ contratoId: CONTRATO_ID, estacoesVinculadas: 1 });

    expect(estacao.updateMany).toHaveBeenCalledWith({
      where: {
        id: { in: [ESTACAO_ID] },
        contratoId: null,
        statusOperacional: 'ATIVA',
      },
      data: { contratoId: CONTRATO_ID },
    });
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'contratos.estacoes.vincular',
        entidadeId: CONTRATO_ID,
        usuarioId: ADMIN.id,
        detalhes: { estacaoIds: [UUID_ESTACAO] },
      }),
    });
  });

  it('restringe vinculação e desvinculação ao administrador', async () => {
    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', monitorCookie)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/contratos/${CONTRATO_ID}/estacoes/${UUID_ESTACAO}`)
      .set('Cookie', monitorCookie)
      .expect(403);

    expect(estacao.updateMany).not.toHaveBeenCalled();
    expect(logAuditoria.create.mock.calls.flat().join(' ')).not.toContain(
      'contratos.estacoes.vincular',
    );
    expect(logAuditoria.create.mock.calls.flat().join(' ')).not.toContain(
      'contratos.estacoes.desvincular',
    );
  });

  it('rejeita contrato não vigente, estação inativa, ausente ou vinculada a outro contrato', async () => {
    contrato.findUnique.mockResolvedValueOnce({
      id: CONTRATO_ID,
      status: 'RASCUNHO',
    });
    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(400);

    contrato.findUnique.mockResolvedValueOnce({
      id: CONTRATO_ID,
      status: 'ENCERRADO',
    });
    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(400);

    estacao.findMany.mockResolvedValueOnce([
      { id: ESTACAO_ID, statusOperacional: 'INATIVA', contratoId: null },
    ]);
    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(400);

    estacao.findMany.mockResolvedValueOnce([]);
    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(404);

    estacao.findMany.mockResolvedValueOnce([
      {
        id: ESTACAO_ID,
        statusOperacional: 'ATIVA',
        contratoId: 'outro-contrato',
      },
    ]);
    await request(app.getHttpServer())
      .post(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', adminCookie)
      .send({ estacaoIds: [UUID_ESTACAO] })
      .expect(409);

    expect(estacao.updateMany).not.toHaveBeenCalled();
  });

  it('desvincula estação e registra auditoria', async () => {
    await request(app.getHttpServer())
      .delete(`/contratos/${CONTRATO_ID}/estacoes/${UUID_ESTACAO}`)
      .set('Cookie', adminCookie)
      .expect(200)
      .expect({ contratoId: CONTRATO_ID, estacaoId: UUID_ESTACAO });

    expect(estacao.updateMany).toHaveBeenCalledWith({
      where: { id: ESTACAO_ID, contratoId: CONTRATO_ID },
      data: { contratoId: null },
    });
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'contratos.estacoes.desvincular',
        entidadeId: CONTRATO_ID,
        usuarioId: ADMIN.id,
        detalhes: { estacaoId: UUID_ESTACAO },
      }),
    });
  });
});
