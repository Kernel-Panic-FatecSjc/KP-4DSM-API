import { INestApplication, Type } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { Test, TestingModuleBuilder } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { AppModule } from '../src/app.module';
import { configurarApp } from '../src/configurar-app';
import { PrismaService } from '../src/prisma/prisma.service';

export interface OpcoesAppDeTeste {
  prismaMock?: unknown;
  modulo?: Type<unknown>;
}

export async function criarAppDeTeste(opcoes: OpcoesAppDeTeste = {}): Promise<INestApplication> {
  let builder: TestingModuleBuilder = Test.createTestingModule({ imports: [opcoes.modulo ?? AppModule] });

  if (opcoes.prismaMock) {
    builder = builder.overrideProvider(PrismaService).useValue(opcoes.prismaMock);
  }

  const app = (await builder.compile()).createNestApplication();
  configurarApp(app);
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

/** CNPJ com dígitos verificadores válidos e aleatório, para não colidir entre execuções e suítes. */
export function gerarCnpj(): string {
  const digitos = Array.from({ length: 12 }, () => Math.floor(Math.random() * 10));
  for (const pesos of [
    [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
    [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2],
  ]) {
    const resto = digitos.reduce((soma, digito, i) => soma + digito * pesos[i], 0) % 11;
    digitos.push(resto < 2 ? 0 : 11 - resto);
  }
  return digitos.join('');
}

/** Cria o usuário direto no banco (bootstrap) e devolve o cookie de uma sessão dele. */
export async function criarSessaoDeTeste(
  app: INestApplication,
  tipo: 'ADMINISTRADOR' | 'MONITOR',
): Promise<{ cookie: string[]; usuarioId: string }> {
  const credenciais = { email: emailDeTeste(`sessao-${randomUUID().slice(0, 8)}`), senha: 'senha12345' };
  const usuario = await app.get(PrismaService).usuario.create({
    data: {
      // sem a palavra do tipo no nome: outras suítes buscam usuários por "Monitor" no mesmo banco
      nome: `Sessão ${randomUUID().slice(0, 8)}`,
      email: credenciais.email,
      senhaHash: await bcrypt.hash(credenciais.senha, 10),
      tipo,
    },
  });
  return { cookie: await autenticar(app, credenciais), usuarioId: usuario.id };
}
