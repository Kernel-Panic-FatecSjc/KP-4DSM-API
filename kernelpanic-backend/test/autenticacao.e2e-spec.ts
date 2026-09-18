import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import cookieParser from 'cookie-parser';
import request from 'supertest';
import type { App } from 'supertest/types';
import { AppModule } from '../src/app.module';
import { PrismaService } from '../src/prisma/prisma.service';

describe('Autenticação (e2e)', () => {
  let app: INestApplication<App>;
  let prisma: PrismaService;

  const admin = { nome: 'Admin E2E', email: `e2e-admin-${Date.now()}@teste.com`, senha: 'senha12345' };
  const usuario = { nome: 'Usuário E2E', email: `e2e-${Date.now()}@teste.com`, senha: 'senha12345' };
  const monitor = { nome: 'Monitor E2E', email: `e2e-monitor-${Date.now()}@teste.com`, senha: 'senha12345' };
  let adminCookie: string[];
  let monitorCookie: string[];
  let outroUsuarioId: string;

  beforeAll(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.use(cookieParser());
    app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
    await app.init();

    prisma = moduleFixture.get(PrismaService);

    // Usuário criado diretamente no banco (bootstrap), simulando o usuário
    // de seed que só existe para permitir a criação dos demais via API.
    await prisma.usuario.create({
      data: { nome: admin.nome, email: admin.email, senhaHash: await bcrypt.hash(admin.senha, 10) },
    });
    await prisma.usuario.create({
      data: { nome: monitor.nome, email: monitor.email, senhaHash: await bcrypt.hash(monitor.senha, 10), tipo: 'MONITOR' },
    });

    const respostaLoginAdmin = await request(app.getHttpServer()).post('/autenticacao/login').send(admin);
    adminCookie = respostaLoginAdmin.headers['set-cookie'] as unknown as string[];
    const respostaLoginMonitor = await request(app.getHttpServer()).post('/autenticacao/login').send(monitor);
    monitorCookie = respostaLoginMonitor.headers['set-cookie'] as unknown as string[];
  });

  afterAll(async () => {
    await prisma.usuario.deleteMany({ where: { email: { contains: 'e2e-' } } });
    await app.close();
  });

  it('recusa criar usuário sem estar autenticado', async () => {
    await request(app.getHttpServer()).post('/usuarios').send(usuario).expect(401);
  });

  it('cria um usuário quando autenticado, incluindo o nome', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookie)
      .send(usuario)
      .expect(201);

    expect(resposta.body).toMatchObject({ nome: usuario.nome, email: usuario.email, ativo: true });
    expect(resposta.body.senhaHash).toBeUndefined();
  });

  it('recusa login com senha inválida', async () => {
    await request(app.getHttpServer())
      .post('/autenticacao/login')
      .send({ email: usuario.email, senha: 'senhaErrada' })
      .expect(401);
  });

  it('recusa acesso a rota protegida sem cookie', async () => {
    await request(app.getHttpServer()).get('/autenticacao/perfil').expect(401);
  });

  it('autentica com credenciais válidas, retorna cookie HttpOnly e o nome do usuário', async () => {
    const resposta = await request(app.getHttpServer())
      .post('/autenticacao/login')
      .send(usuario)
      .expect(200);

    const cookie = resposta.headers['set-cookie']?.[0] as string;
    expect(cookie).toContain('access_token=');
    expect(cookie.toLowerCase()).toContain('httponly');
    expect(resposta.body).toMatchObject({ nome: usuario.nome, email: usuario.email });
  });

  it('acessa rota protegida usando o cookie recebido no login', async () => {
    const respostaLogin = await request(app.getHttpServer()).post('/autenticacao/login').send(usuario);
    const cookie = respostaLogin.headers['set-cookie'] as unknown as string[];

    const respostaPerfil = await request(app.getHttpServer())
      .get('/autenticacao/perfil')
      .set('Cookie', cookie)
      .expect(200);

    expect(respostaPerfil.body).toMatchObject({ email: usuario.email });

    await request(app.getHttpServer()).get('/usuarios').set('Cookie', cookie).expect(200);
  });

  it('restringe a listagem de usuários ao administrador', async () => {
    await request(app.getHttpServer()).get('/usuarios').set('Cookie', monitorCookie).expect(403);
  });

  it('permite buscar usuários por nome sem expor senha', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/usuarios')
      .query({ busca: 'Monitor E2E' })
      .set('Cookie', adminCookie)
      .expect(200);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0]).toMatchObject({ nome: monitor.nome, email: monitor.email });
    expect(resposta.body[0].senhaHash).toBeUndefined();
    expect(resposta.body[0].senha).toBeUndefined();
  });

  it('permite que um usuário autenticado edite outro usuário', async () => {
    const outro = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookie)
      .send({ nome: 'Outro E2E', email: `e2e-outro-${Date.now()}@teste.com`, senha: 'senha12345' });
    outroUsuarioId = outro.body.id;

    const respostaLogin = await request(app.getHttpServer()).post('/autenticacao/login').send(usuario);
    const cookie = respostaLogin.headers['set-cookie'] as unknown as string[];

    await request(app.getHttpServer())
      .patch(`/usuarios/${outroUsuarioId}`)
      .set('Cookie', cookie)
      .send({ nome: 'Outro E2E Editado' })
      .expect(200);
  });

  it('ao inativar um usuário, o cookie/token dele já emitido perde validade imediatamente', async () => {
    const vitima = {
      nome: 'Vítima E2E',
      email: `e2e-vitima-${Date.now()}@teste.com`,
      senha: 'senha12345',
    };
    const respostaCriacao = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookie)
      .send(vitima);
    const vitimaId = respostaCriacao.body.id;

    const respostaLoginVitima = await request(app.getHttpServer())
      .post('/autenticacao/login')
      .send(vitima);
    const vitimaCookie = respostaLoginVitima.headers['set-cookie'] as unknown as string[];

    // O cookie funciona normalmente enquanto a conta está ativa.
    await request(app.getHttpServer()).get('/autenticacao/perfil').set('Cookie', vitimaCookie).expect(200);

    // "Remover" um usuário na verdade o inativa.
    const respostaInativacao = await request(app.getHttpServer())
      .delete(`/usuarios/${vitimaId}`)
      .set('Cookie', adminCookie)
      .expect(200);
    expect(respostaInativacao.body.mensagem).toMatch(/inativado/);

    // O mesmo cookie/token, já emitido antes da inativação, deixa de funcionar.
    await request(app.getHttpServer()).get('/autenticacao/perfil').set('Cookie', vitimaCookie).expect(401);

    // E o usuário inativo não consegue mais logar, mesmo com a senha correta.
    await request(app.getHttpServer()).post('/autenticacao/login').send(vitima).expect(401);
  });

  it('faz logout e invalida o cookie', async () => {
    const respostaLogin = await request(app.getHttpServer()).post('/autenticacao/login').send(usuario);
    const cookieLogin = respostaLogin.headers['set-cookie'] as unknown as string[];

    const respostaLogout = await request(app.getHttpServer())
      .post('/autenticacao/logout')
      .set('Cookie', cookieLogin)
      .expect(200);

    const cookieLogout = respostaLogout.headers['set-cookie']?.[0] as string;
    expect(cookieLogout).toMatch(/access_token=;/);
  });
});
