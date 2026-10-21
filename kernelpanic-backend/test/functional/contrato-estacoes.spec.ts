import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ESTACAO_COM_SENSORES } from '../fixtures';
import { criarAppDeTeste } from '../helpers';

const USUARIO = { id: 'usuario-1', email: 'admin@teste.com', tipo: 'ADMINISTRADOR', ativo: true };
const CONTRATO_ID = 'contrato-1';

describe('Hierarquia de contrato, estações e sensores (funcional)', () => {
  let app: INestApplication;
  let cookie: string;
  const usuario = { findUnique: jest.fn() };
  const contrato = { findUnique: jest.fn() };
  const estacao = { findMany: jest.fn() };
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        contrato,
        estacao,
        logAuditoria,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
    });
    cookie = `access_token=${app.get(JwtService).sign({ sub: USUARIO.id, email: USUARIO.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(USUARIO);
    contrato.findUnique.mockResolvedValue({ id: CONTRATO_ID });
    estacao.findMany.mockResolvedValue([ESTACAO_COM_SENSORES]);
  });

  afterAll(async () => app.close());

  it('retorna estações e sensores vinculados, ordenados, e registra consulta na auditoria', async () => {
    const resposta = await request(app.getHttpServer())
      .get(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', cookie)
      .expect(200);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0]).toMatchObject({
      id: ESTACAO_COM_SENSORES.id,
      sensores: [{ nome: 'Pluviômetro', unidade: 'mm' }],
    });
    expect(estacao.findMany).toHaveBeenCalledWith({
      where: { contratoId: CONTRATO_ID },
      include: { parametros: { include: { tipoParametro: true } } },
      orderBy: [{ nome: 'asc' }, { id: 'asc' }],
    });
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'contratos.estacoes.consultar',
        entidade: 'Contrato',
        entidadeId: CONTRATO_ID,
        usuarioId: USUARIO.id,
      }),
    });
  });

  it('retorna lista vazia para contrato sem estações', async () => {
    estacao.findMany.mockResolvedValue([]);

    await request(app.getHttpServer())
      .get(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', cookie)
      .expect(200)
      .expect([]);
  });

  it('retorna 404 se o contrato não existe sem consultar estações ou auditar', async () => {
    contrato.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .get(`/contratos/${CONTRATO_ID}/estacoes`)
      .set('Cookie', cookie)
      .expect(404);
    expect(estacao.findMany).not.toHaveBeenCalled();
    expect(logAuditoria.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ acao: 'contratos.estacoes.consultar' }),
    });
  });

  it('exige autenticação e documenta a rota no Swagger', async () => {
    await request(app.getHttpServer()).get(`/contratos/${CONTRATO_ID}/estacoes`).expect(401);

    const swagger = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(swagger.body.paths['/contratos/{id}/estacoes']).toHaveProperty('get');
  });
});
