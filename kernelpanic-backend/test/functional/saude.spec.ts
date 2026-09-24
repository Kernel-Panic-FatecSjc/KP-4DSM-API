import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

describe('SaudeController (funcional)', () => {
  const prismaMock = { $connect: jest.fn(), $disconnect: jest.fn(), $queryRaw: jest.fn() };
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarAppDeTeste({ prismaMock });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health responde 200 quando o banco responde', () => {
    prismaMock.$queryRaw.mockResolvedValueOnce([{ '?column?': 1 }]);

    return request(app.getHttpServer())
      .get('/health')
      .expect(200)
      .expect((resposta) => {
        expect(resposta.body).toMatchObject({ status: 'ok', banco: 'ok' });
      });
  });

  // O healthcheck do deploy depende deste 503 para disparar o rollback
  // automático quando a nova versão sobe mas não alcança o banco.
  it('GET /health responde 503 quando o banco está indisponível', () => {
    prismaMock.$queryRaw.mockRejectedValueOnce(new Error('conexão recusada'));

    return request(app.getHttpServer())
      .get('/health')
      .expect(503)
      .expect((resposta) => {
        expect(resposta.body).toMatchObject({ status: 'erro', banco: 'indisponivel' });
      });
  });
});
