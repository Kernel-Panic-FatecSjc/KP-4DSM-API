import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { StatusContrato } from '../../src/generated/prisma/client';
import { criarAppDeTeste } from '../helpers';

const ADMIN = {
  id: 'admin-1',
  email: 'admin@teste.com',
  tipo: 'ADMINISTRADOR',
  ativo: true,
};
const ORGAO = { id: 'orgao-1', nome: 'Prefeitura', cnpj: null };
const CONTRATO = {
  id: 'contrato-1',
  numero: 'CTR-2026-001',
  objeto: 'Monitoramento',
  inicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
  fimVigencia: new Date('2026-12-31T23:59:59.999Z'),
  status: StatusContrato.VIGENTE,
  criadoEm: new Date('2026-01-01T00:00:00.000Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
  encerradoEm: null,
  orgaoId: ORGAO.id,
  orgao: ORGAO,
};

describe('Listagem de contratos (funcional)', () => {
  let app: INestApplication;
  let cookieAdmin: string;
  const usuario = { findUnique: jest.fn() };
  const contrato = {
    findMany: jest.fn(),
    count: jest.fn(),
  };
  const estacao = { groupBy: jest.fn() };
  const logAuditoria = { create: jest.fn().mockResolvedValue({}) };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        usuario,
        contrato,
        estacao,
        logAuditoria,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
        $transaction: jest.fn((operacoes) => Promise.all(operacoes)),
      },
    });
    const jwt = app.get(JwtService);
    cookieAdmin = `access_token=${jwt.sign({ sub: ADMIN.id, email: ADMIN.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(ADMIN);
    contrato.findMany.mockResolvedValue([CONTRATO]);
    contrato.count.mockResolvedValue(1);
    estacao.groupBy.mockResolvedValue([
      { contratoId: CONTRATO.id, _count: { _all: 2 } },
    ]);
    logAuditoria.create.mockResolvedValue({});
  });

  afterAll(async () => app.close());

  it('lista contratos filtrados, pagina, sem auditoria duplicada do GET', async () => {
    await request(app.getHttpServer())
      .get('/contratos?status=VIGENTE&orgaoId=orgao-1&busca=CTR&pagina=1&tamanho=10')
      .set('Cookie', cookieAdmin)
      .expect(200)
      .expect(({ body }) => {
        expect(body).toMatchObject({
          total: 1,
          pagina: 1,
          tamanho: 10,
          contratos: [
            {
              id: CONTRATO.id,
              quantidadeEstacoes: 2,
              orgao: { id: ORGAO.id, nome: ORGAO.nome },
            },
          ],
        });
      });

    expect(contrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          status: StatusContrato.VIGENTE,
          orgaoId: ORGAO.id,
        }),
      }),
    );
    // o middleware de acesso já cobre o GET; a rota não grava 'contratos.consultar'
    expect(logAuditoria.create).not.toHaveBeenCalledWith({
      data: expect.objectContaining({ acao: 'contratos.consultar' }),
    });
  });

  it('documenta a rota de listagem no Swagger', async () => {
    const resposta = await request(app.getHttpServer()).get('/docs-json').expect(200);
    expect(resposta.body.paths['/contratos']).toHaveProperty('get');
  });
});
