import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

describe('AppController (funcional)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarAppDeTeste({ prismaMock: { $connect: jest.fn(), $disconnect: jest.fn() } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET / responde com o health check', () => {
    return request(app.getHttpServer()).get('/').expect(200).expect('Hello World!');
  });
});
