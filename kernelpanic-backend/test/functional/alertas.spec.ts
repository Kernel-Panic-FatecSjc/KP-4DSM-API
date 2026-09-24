import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { ALERTA_COM_RELACOES, NOVO_ALERTA, PARAMETRO_CHUVA } from '../fixtures';
import { criarAppDeTeste } from '../helpers';

const ADMIN = { id: 'admin-1', email: 'admin@teste.com', tipo: 'ADMINISTRADOR', ativo: true };
const MONITOR = { id: 'monitor-1', email: 'monitor@teste.com', tipo: 'MONITOR', ativo: true };

describe('Cadastro de alertas (funcional)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let monitorCookie: string;
  const usuario = { findUnique: jest.fn() };
  const parametro = { findUnique: jest.fn() };
  const alerta = { create: jest.fn() };
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { usuario, parametro, alerta, logAuditoria, $connect: jest.fn(), $disconnect: jest.fn() },
    });

    const jwt = app.get(JwtService);
    adminCookie = `access_token=${jwt.sign({ sub: ADMIN.id, email: ADMIN.email })}`;
    monitorCookie = `access_token=${jwt.sign({ sub: MONITOR.id, email: MONITOR.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockImplementation(({ where }) =>
      [ADMIN, MONITOR].find((existente) => existente.id === where.id) ?? null,
    );
    parametro.findUnique.mockResolvedValue({ id: PARAMETRO_CHUVA });
    alerta.create.mockResolvedValue(ALERTA_COM_RELACOES);
  });

  afterAll(async () => {
    await app.close();
  });

  const postar = (payload: object, cookie = adminCookie) =>
    request(app.getHttpServer()).post('/alertas').set('Cookie', cookie).send(payload);

  it('persiste a regra e responde 201 com a configuração completa', async () => {
    const resposta = await postar(NOVO_ALERTA).expect(201);

    expect(resposta.body).toMatchObject({
      id: ALERTA_COM_RELACOES.id,
      operador: NOVO_ALERTA.operador,
      valorLimite: NOVO_ALERTA.valorLimite,
      severidade: NOVO_ALERTA.severidade,
      ativo: true,
      estacao: { id: ALERTA_COM_RELACOES.parametro.estacao.id },
      parametro: { nome: 'Pluviômetro', unidade: 'mm' },
    });
    expect(alerta.create).toHaveBeenCalledWith(expect.objectContaining({ data: NOVO_ALERTA }));
  });

  it('registra a criação na trilha de auditoria', async () => {
    await postar(NOVO_ALERTA).expect(201);

    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'alertas.criar',
        entidade: 'Alerta',
        entidadeId: ALERTA_COM_RELACOES.id,
        usuarioId: ADMIN.id,
        detalhes: NOVO_ALERTA,
      }),
    });
  });

  it('rejeita dados inválidos com 400 sem persistir nem auditar', async () => {
    await postar({}).expect(400);
    await postar({ ...NOVO_ALERTA, parametroId: 'chuva' }).expect(400);
    await postar({ ...NOVO_ALERTA, valorLimite: 'trinta' }).expect(400);
    await postar({ ...NOVO_ALERTA, severidade: 'CRITICA' }).expect(400);
    await postar({ ...NOVO_ALERTA, operador: '>' }).expect(400);

    expect(alerta.create).not.toHaveBeenCalled();
    expect(logAuditoria.create).not.toHaveBeenCalled();
  });

  it('rejeita com 400 quando o parâmetro monitorado não existe', async () => {
    parametro.findUnique.mockResolvedValue(null);

    await postar(NOVO_ALERTA).expect(400);
    expect(alerta.create).not.toHaveBeenCalled();
    expect(logAuditoria.create).not.toHaveBeenCalled();
  });

  it('recusa com 401 sem autenticação', async () => {
    await request(app.getHttpServer()).post('/alertas').send(NOVO_ALERTA).expect(401);
    expect(alerta.create).not.toHaveBeenCalled();
  });

  it('restringe o cadastro ao administrador', async () => {
    await postar(NOVO_ALERTA, monitorCookie).expect(403);
    expect(alerta.create).not.toHaveBeenCalled();
  });
});

describe('Inativação de alertas (funcional)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let monitorCookie: string;
  const usuario = { findUnique: jest.fn() };
  const alerta = { findUnique: jest.fn(), update: jest.fn() };
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { usuario, alerta, logAuditoria, $connect: jest.fn(), $disconnect: jest.fn() },
    });

    const jwt = app.get(JwtService);
    adminCookie = `access_token=${jwt.sign({ sub: ADMIN.id, email: ADMIN.email })}`;
    monitorCookie = `access_token=${jwt.sign({ sub: MONITOR.id, email: MONITOR.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockImplementation(({ where }) =>
      [ADMIN, MONITOR].find((existente) => existente.id === where.id) ?? null,
    );
    alerta.findUnique.mockResolvedValue(ALERTA_COM_RELACOES);
    alerta.update.mockResolvedValue({ ...ALERTA_COM_RELACOES, ativo: false });
  });

  afterAll(async () => {
    await app.close();
  });

  const remover = (cookie = adminCookie) =>
    request(app.getHttpServer()).delete(`/alertas/${ALERTA_COM_RELACOES.id}`).set('Cookie', cookie);

  it('desativa a regra em vez de apagar, preservando os alarmes disparados', async () => {
    const resposta = await remover().expect(200);

    expect(resposta.body.mensagem).toMatch(/inativado/);
    expect(alerta.update).toHaveBeenCalledWith(
      expect.objectContaining({ where: { id: ALERTA_COM_RELACOES.id }, data: { ativo: false } }),
    );
  });

  it('registra a inativação na trilha de auditoria', async () => {
    await remover().expect(200);

    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'alertas.inativar',
        entidade: 'Alerta',
        entidadeId: ALERTA_COM_RELACOES.id,
        usuarioId: ADMIN.id,
      }),
    });
  });

  it('responde 404 quando o alerta não existe', async () => {
    alerta.findUnique.mockResolvedValue(null);

    await remover().expect(404);
    expect(alerta.update).not.toHaveBeenCalled();
  });

  it('restringe a inativação ao administrador', async () => {
    await remover(monitorCookie).expect(403);
    expect(alerta.update).not.toHaveBeenCalled();
  });

  it('recusa com 401 sem autenticação', async () => {
    await request(app.getHttpServer())
      .delete(`/alertas/${ALERTA_COM_RELACOES.id}`)
      .expect(401);
    expect(alerta.update).not.toHaveBeenCalled();
  });
});
