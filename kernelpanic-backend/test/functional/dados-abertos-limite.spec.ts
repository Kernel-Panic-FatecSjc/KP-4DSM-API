import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

// Mesmo padrão de limite-requisicoes.spec.ts: as rotas públicas de dados abertos
// ficam sob o limite de requisições por IP e, bloqueadas, não entregam dado nenhum.
describe('Dados abertos: limite de requisições (funcional)', () => {
  let app: INestApplication;
  const valorOriginal = process.env.LIMITE_REQUISICOES_POR_MINUTO;
  const estacao = { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) };
  const alarme = { count: jest.fn().mockResolvedValue(0), findMany: jest.fn().mockResolvedValue([]) };
  const $queryRaw = jest.fn().mockResolvedValue([]);

  beforeAll(async () => {
    process.env.LIMITE_REQUISICOES_POR_MINUTO = '3';
    app = await criarAppDeTeste({
      prismaMock: { estacao, alarme, $queryRaw, logAuditoria: { create: jest.fn() }, $connect: jest.fn(), $disconnect: jest.fn() },
    });
  });

  afterAll(async () => {
    process.env.LIMITE_REQUISICOES_POR_MINUTO = valorOriginal;
    await app.close();
  });

  // O contador do limite é por IP e por rota: cada uma tem a sua cota.
  const rotas = [
    '/v1/dados-abertos/estacoes',
    '/v1/dados-abertos/alarmes?de=2026-11-01&ate=2026-11-02',
    '/v1/dados-abertos/medidas?de=2026-11-01&ate=2026-11-02&granularidade=hora',
  ];

  it.each(rotas)('%s: responde 429 com Retry-After ao passar do limite e não entrega dados', async (rota) => {
    for (let i = 0; i < 3; i++) {
      await request(app.getHttpServer()).get(rota).expect(200);
    }
    [estacao.findMany, alarme.findMany, $queryRaw].forEach((mock) => mock.mockClear());

    const bloqueada = await request(app.getHttpServer()).get(rota).expect(429);

    expect(bloqueada.headers['retry-after']).toBeDefined();
    expect(bloqueada.body).not.toHaveProperty('dados');
    // O bloqueio vale também para o CSV da mesma rota, e nem chega ao banco.
    await request(app.getHttpServer()).get(`${rota}${rota.includes('?') ? '&' : '?'}formato=csv`).expect(429);
    expect(estacao.findMany).not.toHaveBeenCalled();
    expect(alarme.findMany).not.toHaveBeenCalled();
    expect($queryRaw).not.toHaveBeenCalled();
  });
});
