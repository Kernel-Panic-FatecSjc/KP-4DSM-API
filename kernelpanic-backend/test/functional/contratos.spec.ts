import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { EsferaOrgao, StatusContrato } from '../../src/generated/prisma/client';
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
const ORGAO = {
  id: 'orgao-1',
  nome: 'Prefeitura',
  cnpj: null,
  esfera: EsferaOrgao.MUNICIPAL,
  municipio: 'São José dos Campos',
  uf: 'SP',
  ativo: true,
  criadoEm: new Date('2026-01-01T00:00:00.000Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
};
const CONTRATO = {
  id: 'contrato-1',
  numero: 'CTR-2026-001',
  objeto: 'Monitoramento',
  inicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
  fimVigencia: new Date('2026-12-31T23:59:59.999Z'),
  status: StatusContrato.RASCUNHO,
  criadoEm: new Date('2026-01-01T00:00:00.000Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
  encerradoEm: null,
  orgaoId: ORGAO.id,
  orgao: ORGAO,
};

describe('Contratos (funcional)', () => {
  let app: INestApplication;
  let adminCookie: string;
  let monitorCookie: string;
  const usuario = { findUnique: jest.fn() };
  const orgaoPublico = {
    findUnique: jest.fn(),
    findMany: jest.fn(),
    create: jest.fn(),
  };
  const contrato = {
    findUnique: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const logAuditoria = { create: jest.fn() };
  const alarme = { findMany: jest.fn().mockResolvedValue([]) };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        orgaoPublico,
        contrato,
        logAuditoria,
        alarme,
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
    usuario.findUnique.mockImplementation(
      ({ where }) =>
        [ADMIN, MONITOR].find((user) => user.id === where.id) ?? null,
    );
    orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    orgaoPublico.findMany.mockResolvedValue([ORGAO]);
    orgaoPublico.create.mockResolvedValue(ORGAO);
    contrato.findUnique.mockImplementation(({ where }) =>
      where.id ? CONTRATO : null,
    );
    contrato.create.mockResolvedValue(CONTRATO);
    contrato.update.mockResolvedValue({
      ...CONTRATO,
      objeto: 'Objeto revisado',
    });
  });

  afterAll(async () => app.close());

  it('permite consultar órgãos autenticado e cadastrar como administrador com auditoria', async () => {
    await request(app.getHttpServer())
      .get('/orgaos')
      .set('Cookie', monitorCookie)
      .expect(200);
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', adminCookie)
      .send({
        nome: 'Prefeitura',
        esfera: 'MUNICIPAL',
        municipio: 'São José dos Campos',
        uf: 'sp',
      })
      .expect(201);
    expect(orgaoPublico.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        esfera: EsferaOrgao.MUNICIPAL,
        uf: 'SP',
      }),
    });
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'orgaos.criar',
        entidadeId: ORGAO.id,
        usuarioId: ADMIN.id,
      }),
    });
  });

  it('restringe o cadastro de órgão ao administrador', async () => {
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', monitorCookie)
      .send({
        nome: 'Prefeitura',
        esfera: 'MUNICIPAL',
        municipio: 'São José dos Campos',
        uf: 'SP',
      })
      .expect(403);
    expect(orgaoPublico.create).not.toHaveBeenCalled();
  });

  it('responde 409 quando o CNPJ já está cadastrado', async () => {
    orgaoPublico.create.mockRejectedValueOnce(
      Object.assign(new Error('unique'), { code: 'P2002' }),
    );
    await request(app.getHttpServer())
      .post('/orgaos')
      .set('Cookie', adminCookie)
      .send({
        nome: 'Prefeitura',
        cnpj: '12345678000195',
        esfera: 'MUNICIPAL',
        municipio: 'São José dos Campos',
        uf: 'SP',
      })
      .expect(409);
    expect(logAuditoria.create.mock.calls.flat().join(' ')).not.toContain(
      'orgaos.criar',
    );
  });

  it('restringe POST e PATCH ao administrador', async () => {
    await request(app.getHttpServer())
      .post('/contratos')
      .set('Cookie', monitorCookie)
      .send({
        numero: 'CTR-2026-001',
        objeto: 'Monitoramento',
        inicioVigencia: '2026-01-01',
        fimVigencia: '2026-12-31',
        orgaoId: ORGAO.id,
      })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/contratos/${CONTRATO.id}`)
      .set('Cookie', monitorCookie)
      .send({ objeto: 'Objeto revisado' })
      .expect(403);
    expect(contrato.create).not.toHaveBeenCalled();
    expect(contrato.update).not.toHaveBeenCalled();
    expect(logAuditoria.create).toHaveBeenCalledTimes(2);
    expect(logAuditoria.create.mock.calls.flat().join(' ')).not.toContain(
      'contratos.criar',
    );
    expect(logAuditoria.create.mock.calls.flat().join(' ')).not.toContain(
      'contratos.atualizar',
    );
  });

  it('cria como administrador e audita a operação', async () => {
    await request(app.getHttpServer())
      .post('/contratos')
      .set('Cookie', adminCookie)
      .send({
        numero: 'CTR-2026-001',
        objeto: 'Monitoramento',
        inicioVigencia: '2026-01-01',
        fimVigencia: '2026-12-31',
        orgaoId: ORGAO.id,
      })
      .expect(201);
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'contratos.criar',
        entidadeId: CONTRATO.id,
        usuarioId: ADMIN.id,
      }),
    });
  });

  it('atualiza como administrador e registra a auditoria', async () => {
    await request(app.getHttpServer())
      .patch(`/contratos/${CONTRATO.id}`)
      .set('Cookie', adminCookie)
      .send({ objeto: 'Objeto revisado' })
      .expect(200);
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'contratos.atualizar',
        entidadeId: CONTRATO.id,
        usuarioId: ADMIN.id,
      }),
    });
  });
});
