import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

const USUARIO = { id: 'usuario-1', email: 'user@teste.com', tipo: 'ADMINISTRADOR', ativo: true };

const NOVO_SENSOR = { nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2 };
const SENSOR = { id: 'sensor-1', ...NOVO_SENSOR, json: null, _count: { parametros: 0 } };

describe('Cadastro de sensores (funcional)', () => {
  let app: INestApplication;
  let cookie: string;
  const usuario = { findUnique: jest.fn() };
  const tipoParametro = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { usuario, tipoParametro, logAuditoria, $connect: jest.fn(), $disconnect: jest.fn() },
    });

    const jwt = app.get(JwtService);
    cookie = `access_token=${jwt.sign({ sub: USUARIO.id, email: USUARIO.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(USUARIO);
    tipoParametro.findMany.mockResolvedValue([SENSOR]);
    tipoParametro.findFirst.mockResolvedValue(null);
    tipoParametro.findUnique.mockResolvedValue(SENSOR);
    tipoParametro.create.mockResolvedValue(SENSOR);
    tipoParametro.update.mockImplementation(({ data }) => ({ ...SENSOR, ...data }));
  });

  afterAll(async () => {
    await app.close();
  });

  it('lista os sensores com a contagem de estações que os usam', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/sensores')
      .set('Cookie', cookie)
      .expect(200);

    expect(resposta.body).toEqual([
      { id: 'sensor-1', nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2, estacoesAssociadas: 0 },
    ]);
  });

  it('cadastra um sensor e registra na auditoria', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/sensores')
      .set('Cookie', cookie)
      .send(NOVO_SENSOR)
      .expect(201);

    expect(resposta.body).toMatchObject({ id: 'sensor-1', nome: 'Pluviômetro', unidade: 'mm' });
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'sensores.criar',
        entidade: 'TipoParametro',
        entidadeId: 'sensor-1',
        usuarioId: USUARIO.id,
      }),
    });
  });

  it('rejeita cadastro inválido com 400 sem persistir nem auditar', async () => {
    const postar = (payload: object) =>
      request(app.getHttpServer()).post('/sensores').set('Cookie', cookie).send(payload);

    await postar({}).expect(400);
    await postar({ ...NOVO_SENSOR, nome: '' }).expect(400);
    await postar({ ...NOVO_SENSOR, fator: 'um' }).expect(400);
    await postar({ ...NOVO_SENSOR, ganho: undefined }).expect(400);

    expect(tipoParametro.create).not.toHaveBeenCalled();
    expect(logAuditoria.create).not.toHaveBeenCalled();
  });

  it('responde 409 ao repetir o nome de um sensor existente', async () => {
    tipoParametro.findFirst.mockResolvedValue({ id: 'sensor-1' });

    await request(app.getHttpServer())
      .post('/sensores')
      .set('Cookie', cookie)
      .send(NOVO_SENSOR)
      .expect(409);
    expect(tipoParametro.create).not.toHaveBeenCalled();
  });

  it('atualiza a calibração do sensor', async () => {
    const resposta = await request(app.getHttpServer())
      .patch('/sensores/sensor-1')
      .set('Cookie', cookie)
      .send({ ganho: 0.5 })
      .expect(200);

    expect(resposta.body.ganho).toBe(0.5);
  });

  it('remove sensor sem uso e recusa com 409 o que está associado', async () => {
    await request(app.getHttpServer())
      .delete('/sensores/sensor-1')
      .set('Cookie', cookie)
      .expect(200);
    expect(tipoParametro.delete).toHaveBeenCalled();

    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(USUARIO);
    tipoParametro.findUnique.mockResolvedValue({ ...SENSOR, _count: { parametros: 3 } });

    await request(app.getHttpServer())
      .delete('/sensores/sensor-1')
      .set('Cookie', cookie)
      .expect(409);
    expect(tipoParametro.delete).not.toHaveBeenCalled();
  });

  it('responde 404 para sensor inexistente', async () => {
    tipoParametro.findUnique.mockResolvedValue(null);

    await request(app.getHttpServer())
      .patch('/sensores/sumido')
      .set('Cookie', cookie)
      .send({ ganho: 1 })
      .expect(404);
    await request(app.getHttpServer())
      .delete('/sensores/sumido')
      .set('Cookie', cookie)
      .expect(404);
  });

  it('recusa com 401 sem autenticação', async () => {
    await request(app.getHttpServer()).get('/sensores').expect(401);
    await request(app.getHttpServer()).post('/sensores').send(NOVO_SENSOR).expect(401);
  });
});
