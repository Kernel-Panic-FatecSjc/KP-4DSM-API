import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

const ADMIN = {
  id: 'admin-1',
  nome: 'Admin',
  email: 'admin@teste.com',
  tipo: 'ADMINISTRADOR',
  ativo: true,
};
const MONITOR = {
  id: 'monitor-1',
  nome: 'Monitor',
  email: 'monitor@teste.com',
  tipo: 'MONITOR',
  ativo: true,
};

describe('Controle de acesso nas rotas de escrita e leituras brutas', () => {
  let app: INestApplication;
  let adminCookie: string;
  let monitorCookie: string;
  const usuario = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const tipoParametro = {
    findMany: jest.fn(),
    findFirst: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  };
  const estacao = {
    findUnique: jest.fn(),
    update: jest.fn(),
    create: jest.fn(),
  };
  const logAuditoria = { create: jest.fn() };
  const queryRaw = jest.fn();

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        tipoParametro,
        estacao,
        logAuditoria,
        $queryRaw: queryRaw,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
    });
    const jwt = app.get(JwtService);
    adminCookie = `access_token=${jwt.sign({ sub: ADMIN.id, email: ADMIN.email })}`;
    monitorCookie = `access_token=${jwt.sign({ sub: MONITOR.id, email: MONITOR.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockImplementation(({ where }) => {
      if (where.id === ADMIN.id) return Promise.resolve(ADMIN);
      if (where.id === MONITOR.id) return Promise.resolve(MONITOR);
      return Promise.resolve(null);
    });
    usuario.create.mockImplementation(({ data }) =>
      Promise.resolve({ id: 'new-user', ativo: true, ...data }),
    );
    tipoParametro.findMany.mockResolvedValue([]);
    tipoParametro.findFirst.mockResolvedValue(null);
    tipoParametro.findUnique.mockResolvedValue({ id: 'sensor-1', _count: { parametros: 0 } });
    tipoParametro.create.mockResolvedValue({ id: 'sensor-1', nome: 'Chuva' });
    tipoParametro.update.mockResolvedValue({ id: 'sensor-1', nome: 'Chuva' });
    estacao.findUnique.mockResolvedValue({ id: 'estacao-1', vid: 'ESP32-1' });
    estacao.create.mockResolvedValue({ id: 'estacao-1' });
    estacao.update.mockResolvedValue({ id: 'estacao-1' });
    logAuditoria.create.mockResolvedValue({});
  });

  afterAll(async () => app.close());

  it('impede MONITOR de criar, editar ou inativar usuários', async () => {
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', monitorCookie)
      .send({ nome: 'Outro', email: 'outro@teste.com', senha: 'senha12345', tipo: 'ADMINISTRADOR' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/usuarios/usuario-alvo')
      .set('Cookie', monitorCookie)
      .send({ nome: 'Alterado' })
      .expect(403);
    await request(app.getHttpServer())
      .delete('/usuarios/usuario-alvo')
      .set('Cookie', monitorCookie)
      .expect(403);

    expect(usuario.create).not.toHaveBeenCalled();
    expect(usuario.update).not.toHaveBeenCalled();
  });

  it('permite ao administrador cadastrar um usuário MONITOR e persiste o perfil enviado', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookie)
      .send({ nome: 'Novo Monitor', email: 'novo-monitor@teste.com', senha: 'senha12345', tipo: 'MONITOR' })
      .expect(201);

    expect(resposta.body.tipo).toBe('MONITOR');
    expect(usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'MONITOR' }),
    });
  });

  it('impede MONITOR de criar, editar ou excluir sensores', async () => {
    await request(app.getHttpServer())
      .post('/sensores')
      .set('Cookie', monitorCookie)
      .send({ nome: 'Chuva', unidade: 'mm', fator: 1, ganho: 1 })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/sensores/sensor-1')
      .set('Cookie', monitorCookie)
      .send({ ganho: 2 })
      .expect(403);
    await request(app.getHttpServer())
      .delete('/sensores/sensor-1')
      .set('Cookie', monitorCookie)
      .expect(403);

    expect(tipoParametro.create).not.toHaveBeenCalled();
    expect(tipoParametro.update).not.toHaveBeenCalled();
    expect(tipoParametro.delete).not.toHaveBeenCalled();
  });

  it('impede MONITOR de criar, editar ou inativar estações', async () => {
    await request(app.getHttpServer())
      .post('/estacoes')
      .set('Cookie', monitorCookie)
      .send({ nome: 'Estação', endereco: 'Rua A', vid: 'ESP32-10' })
      .expect(403);
    await request(app.getHttpServer())
      .patch('/estacoes/estacao-1')
      .set('Cookie', monitorCookie)
      .send({ nome: 'Alterada' })
      .expect(403);
    await request(app.getHttpServer())
      .delete('/estacoes/estacao-1')
      .set('Cookie', monitorCookie)
      .expect(403);

    expect(estacao.create).not.toHaveBeenCalled();
    expect(estacao.update).not.toHaveBeenCalled();
  });

  it('requer JWT para consultar leituras brutas', async () => {
    await request(app.getHttpServer()).get('/leituras-brutas').expect(401);
    expect(queryRaw).not.toHaveBeenCalled();

    queryRaw.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: 0n }]);
    const resposta = await request(app.getHttpServer())
      .get('/leituras-brutas')
      .set('Cookie', monitorCookie)
      .expect(200);

    expect(resposta.body).toMatchObject({ itens: [], total: 0, pagina: 1, tamanho: 50 });
    expect(queryRaw).toHaveBeenCalledTimes(2);
  });

  it('retorna 401 nas rotas de escrita de usuários, sensores e estações sem token', async () => {
    const http = () => request(app.getHttpServer());

    await http().post('/usuarios').send({ nome: 'X', email: 'x@teste.com', senha: 'senha12345' }).expect(401);
    await http().patch('/usuarios/usuario-alvo').send({ nome: 'Alterado' }).expect(401);
    await http().delete('/usuarios/usuario-alvo').expect(401);
    await http().post('/sensores').send({ nome: 'Chuva', unidade: 'mm', fator: 1, ganho: 1 }).expect(401);
    await http().patch('/sensores/sensor-1').send({ ganho: 2 }).expect(401);
    await http().delete('/sensores/sensor-1').expect(401);
    await http().post('/estacoes').send({ nome: 'Estação', endereco: 'Rua A', vid: 'ESP32-10' }).expect(401);
    await http().patch('/estacoes/estacao-1').send({ nome: 'Alterada' }).expect(401);
    await http().delete('/estacoes/estacao-1').expect(401);

    expect(usuario.create).not.toHaveBeenCalled();
    expect(usuario.update).not.toHaveBeenCalled();
    expect(tipoParametro.create).not.toHaveBeenCalled();
    expect(tipoParametro.update).not.toHaveBeenCalled();
    expect(tipoParametro.delete).not.toHaveBeenCalled();
    expect(estacao.create).not.toHaveBeenCalled();
    expect(estacao.update).not.toHaveBeenCalled();
  });

  it('cadastra como MONITOR quando o administrador não informa o perfil', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookie)
      .send({ nome: 'Sem Perfil', email: 'sem-perfil@teste.com', senha: 'senha12345' })
      .expect(201);

    expect(resposta.body.tipo).toBe('MONITOR');
    expect(usuario.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ tipo: 'MONITOR' }),
    });
  });
});
