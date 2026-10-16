import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
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
  id: '2d0f7b6f-1a40-4a65-9a4f-650bbafc648e',
  nome: 'Prefeitura',
  cnpj: null,
  ativo: true,
};
const CONTRATO = {
  id: 'contrato-1',
  numero: 'CTR-2026-001',
  objeto: 'Monitoramento',
  inicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
  fimVigencia: new Date('2026-12-31T00:00:00.000Z'),
  status: 'RASCUNHO',
  criadoEm: new Date('2026-01-01T00:00:00.000Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
  encerradoEm: null,
  orgaoId: ORGAO.id,
  orgao: ORGAO,
};
const CORPO_VALIDO = {
  numero: 'CTR-2026-001',
  objeto: 'Monitoramento',
  inicioVigencia: '2026-01-01',
  fimVigencia: '2026-12-31',
  orgaoId: ORGAO.id,
};

describe('Contratos (funcional)', () => {
  let app: INestApplication;
  let cookieAdmin: string;
  let cookieMonitor: string;
  const usuario = { findUnique: jest.fn() };
  const contrato = {
    findMany: jest.fn(),
    findUnique: jest.fn(),
    count: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
  };
  const orgao = { findUnique: jest.fn() };
  const logAuditoria = { create: jest.fn() };

  const auditoriasDe = (acao: string) =>
    logAuditoria.create.mock.calls
      .map(([argumento]) => argumento.data)
      .filter((dados) => dados.acao === acao);

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        contrato,
        orgao,
        logAuditoria,
        $transaction: jest.fn(
          (operacoes: Promise<unknown>[]) => Promise.all(operacoes),
        ),
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
    usuario.findUnique.mockImplementation(
      ({ where }) => [ADMIN, MONITOR].find((u) => u.id === where.id) ?? null,
    );
    contrato.findMany.mockResolvedValue([CONTRATO]);
    contrato.count.mockResolvedValue(1);
    contrato.findUnique.mockImplementation(({ where }) =>
      where.id === CONTRATO.id ? CONTRATO : null,
    );
    contrato.create.mockImplementation(({ data }) => ({
      ...CONTRATO,
      ...Object.fromEntries(
        Object.entries(data).filter(([, valor]) => valor !== undefined),
      ),
      orgao: ORGAO,
    }));
    contrato.update.mockImplementation(({ data }) => ({
      ...CONTRATO,
      ...Object.fromEntries(
        Object.entries(data).filter(([, valor]) => valor !== undefined),
      ),
    }));
    orgao.findUnique.mockResolvedValue(ORGAO);
    logAuditoria.create.mockResolvedValue({});
  });

  afterAll(async () => {
    await app.close();
  });

  describe('autenticaÃƒÂ§ÃƒÂ£o e permissÃƒÂ£o', () => {
    it('exige login para consultar', async () => {
      await request(app.getHttpServer()).get('/contratos').expect(401);
    });

    it('permite que qualquer usuÃƒÂ¡rio autenticado consulte', async () => {
      await request(app.getHttpServer())
        .get('/contratos')
        .set('Cookie', cookieMonitor)
        .expect(200);
      await request(app.getHttpServer())
        .get(`/contratos/${CONTRATO.id}`)
        .set('Cookie', cookieMonitor)
        .expect(200);
    });

    it.each([
      ['POST', '/contratos'],
      ['PATCH', '/contratos/contrato-1'],
      ['PATCH', '/contratos/contrato-1/encerrar'],
    ])('nega %s %s a quem nÃƒÂ£o ÃƒÂ© administrador', async (metodo, rota) => {
      await request(app.getHttpServer())
        [metodo.toLowerCase() as 'post' | 'patch'](rota)
        .set('Cookie', cookieMonitor)
        .send(CORPO_VALIDO)
        .expect(403);

      expect(contrato.create).not.toHaveBeenCalled();
      expect(contrato.update).not.toHaveBeenCalled();
    });

    it('nÃƒÂ£o expÃƒÂµe exclusÃƒÂ£o fÃƒÂ­sica', async () => {
      await request(app.getHttpServer())
        .delete(`/contratos/${CONTRATO.id}`)
        .set('Cookie', cookieAdmin)
        .expect(404);
    });
  });

  describe('POST /contratos', () => {
    it('cria e registra na auditoria', async () => {
      const resposta = await request(app.getHttpServer())
        .post('/contratos')
        .set('Cookie', cookieAdmin)
        .send(CORPO_VALIDO)
        .expect(201);

      expect(resposta.body).toMatchObject({
        numero: 'CTR-2026-001',
        status: 'RASCUNHO',
        orgao: { id: ORGAO.id },
      });
      expect(auditoriasDe('contratos.criar')).toEqual([
        expect.objectContaining({
          entidade: 'Contrato',
          usuarioId: ADMIN.id,
          entidadeId: expect.any(String),
        }),
      ]);
    });

    it('remove espaÃƒÂ§os nas pontas do nÃƒÂºmero antes de validar a unicidade', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .set('Cookie', cookieAdmin)
        .send({ ...CORPO_VALIDO, numero: '  CTR-2026-001  ' })
        .expect(201);

      expect(contrato.findUnique).toHaveBeenCalledWith({
        where: { numero: 'CTR-2026-001' },
      });
    });

    it('responde 409 para nÃƒÂºmero repetido e nÃƒÂ£o audita a criaÃƒÂ§ÃƒÂ£o', async () => {
      contrato.findUnique.mockResolvedValue(CONTRATO);

      await request(app.getHttpServer())
        .post('/contratos')
        .set('Cookie', cookieAdmin)
        .send(CORPO_VALIDO)
        .expect(409);
      expect(auditoriasDe('contratos.criar')).toHaveLength(0);
    });

    it('responde 400 para vigÃƒÂªncia invertida', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .set('Cookie', cookieAdmin)
        .send({
          ...CORPO_VALIDO,
          inicioVigencia: '2026-12-31',
          fimVigencia: '2026-01-01',
        })
        .expect(400);
    });

    it('responde 400 para ÃƒÂ³rgÃƒÂ£o inexistente ou inativo', async () => {
      orgao.findUnique.mockResolvedValueOnce(null);
      await request(app.getHttpServer())
        .post('/contratos')
        .set('Cookie', cookieAdmin)
        .send(CORPO_VALIDO)
        .expect(400);

      orgao.findUnique.mockResolvedValueOnce({ ...ORGAO, ativo: false });
      await request(app.getHttpServer())
        .post('/contratos')
        .set('Cookie', cookieAdmin)
        .send(CORPO_VALIDO)
        .expect(400);
    });

    it('responde 400 para corpo invÃƒÂ¡lido', async () => {
      await request(app.getHttpServer())
        .post('/contratos')
        .set('Cookie', cookieAdmin)
        .send({
          numero: '   ',
          objeto: '',
          inicioVigencia: 'ontem',
          orgaoId: 'abc',
        })
        .expect(400);
    });
  });

  describe('PATCH /contratos/:id', () => {
    it('edita e registra os campos alterados na auditoria', async () => {
      await request(app.getHttpServer())
        .patch(`/contratos/${CONTRATO.id}`)
        .set('Cookie', cookieAdmin)
        .send({ objeto: 'Novo objeto' })
        .expect(200);

      expect(auditoriasDe('contratos.atualizar')).toEqual([
        expect.objectContaining({
          entidadeId: CONTRATO.id,
          usuarioId: ADMIN.id,
          detalhes: { campos: ['objeto'] },
        }),
      ]);
    });

    it('responde 400 para transiÃƒÂ§ÃƒÂ£o de status nÃƒÂ£o permitida', async () => {
      await request(app.getHttpServer())
        .patch(`/contratos/${CONTRATO.id}`)
        .set('Cookie', cookieAdmin)
        .send({ status: 'SUSPENSO' })
        .expect(400);
    });

    it('responde 404 para contrato inexistente', async () => {
      await request(app.getHttpServer())
        .patch('/contratos/nao-existe')
        .set('Cookie', cookieAdmin)
        .send({})
        .expect(404);
    });

    it('responde 400 ao tentar editar contrato encerrado', async () => {
      contrato.findUnique.mockResolvedValue({
        ...CONTRATO,
        status: 'ENCERRADO',
        encerradoEm: new Date(),
      });

      await request(app.getHttpServer())
        .patch(`/contratos/${CONTRATO.id}`)
        .set('Cookie', cookieAdmin)
        .send({ objeto: 'tentativa' })
        .expect(400);
    });
  });

  describe('PATCH /contratos/:id/encerrar', () => {
    it('encerra sem excluir e registra na auditoria', async () => {
      contrato.findUnique.mockResolvedValue({ ...CONTRATO, status: 'ATIVO' });

      const resposta = await request(app.getHttpServer())
        .patch(`/contratos/${CONTRATO.id}/encerrar`)
        .set('Cookie', cookieAdmin)
        .expect(200);

      expect(resposta.body.status).toBe('ENCERRADO');
      expect(resposta.body.encerradoEm).not.toBeNull();
      expect(auditoriasDe('contratos.encerrar')).toEqual([
        expect.objectContaining({
          entidadeId: CONTRATO.id,
          usuarioId: ADMIN.id,
        }),
      ]);
    });

    it('responde 400 ao reencerrar', async () => {
      contrato.findUnique.mockResolvedValue({
        ...CONTRATO,
        status: 'ENCERRADO',
        encerradoEm: new Date(),
      });

      await request(app.getHttpServer())
        .patch(`/contratos/${CONTRATO.id}/encerrar`)
        .set('Cookie', cookieAdmin)
        .expect(400);
      expect(contrato.update).not.toHaveBeenCalled();
    });
  });

  describe('Swagger', () => {
    it('documenta todas as rotas de contratos com respostas e schema', () => {
      const documento = SwaggerModule.createDocument(
        app,
        new DocumentBuilder().addBearerAuth().build(),
      );

      expect(
        Object.keys(documento.paths)
          .filter((rota) => rota.startsWith('/contratos'))
          .sort(),
      ).toEqual(['/contratos', '/contratos/{id}', '/contratos/{id}/encerrar']);
      expect(Object.keys(documento.paths['/contratos'])).toEqual(
        expect.arrayContaining(['get', 'post']),
      );
      expect(Object.keys(documento.paths['/contratos/{id}'])).toEqual(
        expect.arrayContaining(['get', 'patch']),
      );
      expect(documento.paths['/contratos/{id}/encerrar']).toHaveProperty(
        'patch',
      );
      expect(documento.paths['/contratos/{id}']).not.toHaveProperty('delete');

      const criar = documento.paths['/contratos'].post!;
      expect(criar.tags).toContain('contratos');
      expect(Object.keys(criar.responses)).toEqual(
        expect.arrayContaining(['201', '400', '401', '403', '409']),
      );

      const schemas = documento.components!.schemas!;
      expect(schemas.ContratoRespostaDto).toMatchObject({
        properties: expect.objectContaining({
          numero: expect.anything(),
          status: expect.anything(),
          orgao: expect.anything(),
        }),
      });
      expect(schemas.CriarContratoDto).toBeDefined();
      expect(schemas.AtualizarContratoDto).toBeDefined();
    });
  });
});
