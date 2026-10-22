import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

const ADMIN = {
  id: 'admin-1',
  email: 'admin@teste.com',
  tipo: 'ADMINISTRADOR',
  ativo: true,
};
const MONITOR = { ...ADMIN, id: 'monitor-1', tipo: 'MONITOR' };
const ORGAO = {
  id: 'orgao-1',
  nome: 'Prefeitura',
  cnpj: '11222333000181',
  esfera: 'MUNICIPAL',
  municipio: 'São Paulo',
  uf: 'SP',
  ativo: true,
  criadoEm: new Date('2026-01-01T00:00:00Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00Z'),
};
const NOVO = {
  nome: 'Prefeitura',
  cnpj: '11.222.333/0001-81',
  esfera: 'MUNICIPAL',
  municipio: 'São Paulo',
  uf: 'sp',
};

describe('Órgãos contratantes (funcional)', () => {
  let app: INestApplication;
  let cookieAdmin: string;
  let cookieMonitor: string;
  const usuario = { findUnique: jest.fn() };
  const orgaoPublico = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        orgaoPublico,
        logAuditoria,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
    });
    const jwt = app.get(JwtService);
    cookieAdmin = `access_token=${jwt.sign({ sub: ADMIN.id, email: ADMIN.email })}`;
    cookieMonitor = `access_token=${jwt.sign({ sub: MONITOR.id, email: MONITOR.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockImplementation(({ where }) =>
      where.id === MONITOR.id ? MONITOR : ADMIN,
    );
    orgaoPublico.findUnique.mockResolvedValue(null);
    orgaoPublico.findMany.mockResolvedValue([ORGAO]);
    orgaoPublico.create.mockImplementation(({ data }) => ({
      ...ORGAO,
      ...data,
    }));
    orgaoPublico.update.mockImplementation(({ data }) => ({
      ...ORGAO,
      ...data,
    }));
    logAuditoria.create.mockResolvedValue({});
  });

  afterAll(async () => app.close());

  it('publica as rotas de órgãos no documento Swagger', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);
    expect(resposta.body.paths).toHaveProperty('/orgaos');
    expect(resposta.body.paths).toHaveProperty('/orgaos/{id}');
  });

  it('lista e consulta órgãos para usuário autenticado sem duplicar auditoria de leitura', async () => {
    await request(app.getHttpServer())
      .get('/orgaos?ativo=true')
      .set('Cookie', cookieMonitor)
      .expect(200)
      .expect(({ body }) => expect(body).toHaveLength(1));
    expect(
      logAuditoria.create.mock.calls.map(([{ data }]) => data.acao),
    ).not.toContain('orgaos.consultar');

    orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    await request(app.getHttpServer())
      .get(`/orgaos/${ORGAO.id}`)
      .set('Cookie', cookieAdmin)
      .expect(200)
      .expect(({ body }) =>
        expect(body).toMatchObject({ id: ORGAO.id, cnpj: ORGAO.cnpj }),
      );
    expect(
      logAuditoria.create.mock.calls.map(([{ data }]) => data.acao),
    ).not.toContain('orgaos.consultar');
  });

  it('não inclui CNPJ na busca de termo textual que contém dígito', async () => {
    await request(app.getHttpServer())
      .get('/orgaos?busca=Escola%205')
      .set('Cookie', cookieAdmin)
      .expect(200);
    expect(orgaoPublico.findMany.mock.calls[0][0].where.OR).toEqual([
      { nome: { contains: 'Escola 5', mode: 'insensitive' } },
      { municipio: { contains: 'Escola 5', mode: 'insensitive' } },
    ]);
  });

  it('exige autenticação para consulta e escrita', async () => {
    await request(app.getHttpServer()).get('/orgaos').expect(401);
    await request(app.getHttpServer()).post('/orgaos').send(NOVO).expect(401);
  });

  it('cadastra como administrador, normaliza valores e audita', async () => {
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', cookieAdmin)
      .send(NOVO)
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({ cnpj: ORGAO.cnpj, uf: 'SP', ativo: true }),
      );
    expect(orgaoPublico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cnpj: ORGAO.cnpj, uf: 'SP' }),
    });
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'orgaos.criar',
        entidadeId: ORGAO.id,
        usuarioId: ADMIN.id,
      }),
    });
  });

  it('cadastra órgão inativo e normaliza CNPJ alfanumérico', async () => {
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', cookieAdmin)
      .send({ ...NOVO, cnpj: '12.ABC.345/01DE-35', ativo: false })
      .expect(201)
      .expect(({ body }) =>
        expect(body).toMatchObject({ cnpj: '12ABC34501DE35', ativo: false }),
      );
    expect(orgaoPublico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        cnpj: '12ABC34501DE35',
        ativo: false,
      }),
    });
  });

  it('cadastra órgão sem CNPJ', async () => {
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', cookieAdmin)
      .send({ ...NOVO, cnpj: null })
      .expect(201)
      .expect(({ body }) => expect(body).toMatchObject({ cnpj: null }));
    expect(orgaoPublico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ cnpj: null }),
    });
  });

  it('rejeita CNPJ inválido e duplicado sem persistir', async () => {
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', cookieAdmin)
      .send({ ...NOVO, cnpj: '123' })
      .expect(400);
    orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', cookieAdmin)
      .send(NOVO)
      .expect(409);
    expect(orgaoPublico.create).not.toHaveBeenCalled();
    expect(
      logAuditoria.create.mock.calls.some(
        ([{ data }]) => data.acao === 'orgaos.criar',
      ),
    ).toBe(false);
  });

  it('restringe cadastro, edição e inativação ao administrador', async () => {
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', cookieMonitor)
      .send(NOVO)
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/orgaos/${ORGAO.id}`)
      .set('Cookie', cookieMonitor)
      .send({ nome: 'Novo' })
      .expect(403);
    await request(app.getHttpServer())
      .delete(`/orgaos/${ORGAO.id}`)
      .set('Cookie', cookieMonitor)
      .expect(403);
    expect(orgaoPublico.create).not.toHaveBeenCalled();
    expect(orgaoPublico.update).not.toHaveBeenCalled();
  });

  it('edita e audita os campos alterados', async () => {
    orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    await request(app.getHttpServer())
      .patch(`/orgaos/${ORGAO.id}`)
      .set('Cookie', cookieAdmin)
      .send({ nome: 'Prefeitura Nova' })
      .expect(200)
      .expect(({ body }) => expect(body.nome).toBe('Prefeitura Nova'));
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'orgaos.atualizar',
        detalhes: { campos: ['nome'] },
      }),
    });
  });

  it('inativa logicamente, mantém o órgão e audita', async () => {
    orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    await request(app.getHttpServer())
      .delete(`/orgaos/${ORGAO.id}`)
      .set('Cookie', cookieAdmin)
      .expect(200)
      .expect(({ body }) => expect(body.ativo).toBe(false));
    expect(orgaoPublico.update).toHaveBeenCalledWith({
      where: { id: ORGAO.id },
      data: { ativo: false },
    });
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'orgaos.inativar',
        entidadeId: ORGAO.id,
      }),
    });
  });
});
