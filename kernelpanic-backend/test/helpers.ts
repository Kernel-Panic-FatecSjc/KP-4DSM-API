import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

export interface OpcoesAppDeTeste {
  prismaMock?: unknown;
}

export async function criarAppDeTeste(opcoes: OpcoesAppDeTeste = {}): Promise<INestApplication> {
  let builder: TestingModuleBuilder = Test.createTestingModule({ imports: [AppModule] });

  if (opcoes.prismaMock) {
    builder = builder.overrideProvider(PrismaService).useValue(opcoes.prismaMock);
  }

  const app = (await builder.compile()).createNestApplication();
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  await app.init();

  return app;
}

export interface Credenciais {
  email: string;
  senha: string;
}

export async function autenticar(app: INestApplication, credenciais: Credenciais): Promise<string[]> {
  const resposta = await request(app.getHttpServer())
    .post('/autenticacao/login')
    .send(credenciais)
    .expect(200);

  return resposta.headers['set-cookie'] as unknown as string[];
}

export const PREFIXO_TESTE = 'teste-';

export function emailDeTeste(rotulo: string): string {
  return `${PREFIXO_TESTE}${rotulo}-${Date.now()}@teste.com`;
}
