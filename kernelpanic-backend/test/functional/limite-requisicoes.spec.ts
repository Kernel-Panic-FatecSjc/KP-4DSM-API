import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

describe('Limite de requisições (funcional)', () => {
  let app: INestApplication;
  const valoresOriginais = {
    geral: process.env.LIMITE_REQUISICOES_POR_MINUTO,
    login: process.env.LIMITE_LOGIN_POR_MINUTO,
  };
  const usuario = { findUnique: jest.fn().mockResolvedValue(null) };
  const alarme = { findMany: jest.fn().mockResolvedValue([]), count: jest.fn().mockResolvedValue(0) };
  const logAuditoria = { create: jest.fn() };
  const $queryRaw = jest.fn().mockResolvedValue([]);
  const rotaVisitante = '/alarmes?latitude=-23.18&longitude=-45.88';

  beforeAll(async () => {
    process.env.LIMITE_REQUISICOES_POR_MINUTO = '3';
    process.env.LIMITE_LOGIN_POR_MINUTO = '2';
    app = await criarAppDeTeste({
      prismaMock: { usuario, alarme, logAuditoria, $queryRaw, $connect: jest.fn(), $disconnect: jest.fn() },
    });
  });

  afterAll(async () => {
    process.env.LIMITE_REQUISICOES_POR_MINUTO = valoresOriginais.geral;
    process.env.LIMITE_LOGIN_POR_MINUTO = valoresOriginais.login;
    await app.close();
  });

  it('responde 429 quando o visitante passa do limite geral', async () => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).get(rotaVisitante).expect(200);
    }
    const resposta = await request(app.getHttpServer()).get(rotaVisitante).expect(429);
    expect(resposta.headers['retry-after']).toBeDefined();
  });

  it('aplica um limite mais baixo às tentativas de login', async () => {
    const tentar = () =>
      request(app.getHttpServer()).post('/autenticacao/login').send({ email: 'x@teste.com', senha: 'errada123' });

    await tentar().expect(401);
    await tentar().expect(401);
    await tentar().expect(429);
  });

  it('não limita a ingestão das estações', async () => {
    for (let i = 0; i < 5; i++) {
      const resposta = await request(app.getHttpServer()).get('/ingestao/estacoes/inexistente/parametros');
      expect(resposta.status).not.toBe(429);
    }
  });
});
