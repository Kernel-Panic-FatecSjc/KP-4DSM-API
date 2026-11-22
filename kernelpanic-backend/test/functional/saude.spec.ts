import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

describe('Saúde do backend (funcional)', () => {
  let app: INestApplication;

  const queryRaw = jest.fn();
  const logAuditoria = { create: jest.fn() };

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { logAuditoria, $queryRaw: queryRaw, $connect: jest.fn(), $disconnect: jest.fn() },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  afterAll(async () => {
    await app.close();
  });

  // A ingestão saiu do backend: o /saude dele só olha o banco (a ingestão e o
  // tratamento têm o /saude próprio, ver ingestao-http.spec.ts e tratamento-banco.spec.ts).
  it('responde 200 quando o banco responde', async () => {
    const resposta = await request(app.getHttpServer()).get('/saude').expect(200);

    expect(resposta.body).toEqual({ banco: 'ok' });
  });

  it('responde 503 apontando o banco quando ele está indisponível', async () => {
    queryRaw.mockRejectedValueOnce(new Error('Banco indisponível'));

    const resposta = await request(app.getHttpServer()).get('/saude').expect(503);

    expect(resposta.body).toMatchObject({ banco: 'falha' });
  });

  it('não gera linha de auditoria de acesso: o monitoramento chama de poucos em poucos segundos', async () => {
    await request(app.getHttpServer()).get('/saude').expect(200);
    // o middleware registra no evento "finish" da resposta
    await new Promise((resolve) => setImmediate(resolve));

    expect(logAuditoria.create).not.toHaveBeenCalled();
  });
});
