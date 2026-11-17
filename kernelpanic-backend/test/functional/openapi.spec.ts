import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { criarAppDeTeste } from '../helpers';

describe('Documentação OpenAPI (funcional)', () => {
  let app: INestApplication;

  beforeAll(async () => {
    app = await criarAppDeTeste({ prismaMock: { $connect: jest.fn(), $disconnect: jest.fn() } });
  });

  afterAll(async () => {
    await app.close();
  });

  it('serve a interface Swagger em /docs sem login', async () => {
    await request(app.getHttpServer()).get('/docs').expect(200);
  });

  it('serve o documento OpenAPI 3 em /docs-json com título, versão e descrição', async () => {
    const { body } = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(body.openapi).toMatch(/^3\.0/);
    expect(body.info).toMatchObject({ title: 'Kernel Panic API', version: '1.0' });
    expect(body.info.description).toBeTruthy();
  });

  it('declara os esquemas de autenticação do cookie JWT e do header x-chave-estacao', async () => {
    const { body } = await request(app.getHttpServer()).get('/docs-json').expect(200);

    expect(body.components.securitySchemes.access_token).toMatchObject({ type: 'apiKey', in: 'cookie' });
    expect(body.components.securitySchemes['x-chave-estacao']).toMatchObject({
      type: 'apiKey',
      in: 'header',
      name: 'x-chave-estacao',
    });
  });

  it('agrupa toda rota da API em uma tag de módulo', async () => {
    const { body } = await request(app.getHttpServer()).get('/docs-json').expect(200);

    const semTag = Object.entries<Record<string, { tags?: string[] }>>(body.paths).flatMap(([caminho, metodos]) =>
      Object.entries(metodos)
        .filter(([, op]) => !op.tags?.length)
        .map(([metodo]) => `${metodo.toUpperCase()} ${caminho}`),
    );

    expect(semTag).toEqual([]);
  });
});
