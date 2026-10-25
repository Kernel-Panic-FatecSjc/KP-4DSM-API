import { INestApplication } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { autenticar, criarAppDeTeste, criarLicitacaoDeTeste, emailDeTeste } from '../helpers';

describe('Autenticação (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;

  const admin = { nome: 'Admin', email: emailDeTeste('admin'), senha: 'senha12345' };
  // licitacaoId preenchido no beforeAll: perfil de licitação sempre tem uma.
  const usuario = { nome: 'Usuário', email: emailDeTeste('usuario'), senha: 'senha12345', licitacaoId: '' };
  let licitacaoId: string;
  const monitor = { nome: 'Monitor', email: emailDeTeste('monitor'), senha: 'senha12345' };
  let adminCookie: string[];
  let monitorCookie: string[];
  let outroUsuarioId: string;

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);

    // Usuário criado diretamente no banco (bootstrap), simulando o usuário
    // de seed que só existe para permitir a criação dos demais via API.
    licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    usuario.licitacaoId = licitacaoId;
    await prisma.usuario.create({
      data: { nome: admin.nome, email: admin.email, senhaHash: await bcrypt.hash(admin.senha, 10), tipo: 'ADMIN_TECSUS' },
    });
    await prisma.usuario.create({
      data: {
        nome: monitor.nome,
        email: monitor.email,
        senhaHash: await bcrypt.hash(monitor.senha, 10),
        tipo: 'USUARIO_LICITACAO',
        licitacaoId,
      },
    });

    adminCookie = await autenticar(app, admin);
    monitorCookie = await autenticar(app, monitor);
  }, 15_000);

  afterAll(async () => {
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

    expect(resposta.body).toMatchObject({
      nome: usuario.nome,
      email: usuario.email,
      ativo: true,
      tipo: 'USUARIO_LICITACAO',
      licitacao: { id: licitacaoId },
    });
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
    const cookie = await autenticar(app, usuario);

    const respostaPerfil = await request(app.getHttpServer())
      .get('/autenticacao/perfil')
      .set('Cookie', cookie)
      .expect(200);

    // O perfil traz o que o front usa para montar o menu: perfil, licitação e se é só leitura.
    expect(respostaPerfil.body).toMatchObject({
      email: usuario.email,
      tipo: 'USUARIO_LICITACAO',
      licitacao: { id: licitacaoId, status: 'VIGENTE' },
      somenteLeitura: false,
    });
  });

  it('restringe a listagem e o cadastro de usuários aos administradores', async () => {
    await request(app.getHttpServer()).get('/usuarios').set('Cookie', monitorCookie).expect(403);
    await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', monitorCookie)
      .send({ nome: 'X', email: emailDeTeste('x'), senha: 'senha12345' })
      .expect(403);
  });

  it('permite buscar usuários por nome sem expor senha', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/usuarios')
      .query({ busca: 'Monitor' })
      .set('Cookie', adminCookie)
      .expect(200);

    expect(resposta.body).toHaveLength(1);
    expect(resposta.body[0]).toMatchObject({ nome: monitor.nome, email: monitor.email });
    expect(resposta.body[0].senhaHash).toBeUndefined();
    expect(resposta.body[0].senha).toBeUndefined();
  });

  it('cada um edita os próprios dados, mas o usuário comum não edita os de outra pessoa', async () => {
    const outro = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookie)
      .send({ nome: 'Outro', email: emailDeTeste('outro'), senha: 'senha12345', licitacaoId });
    outroUsuarioId = outro.body.id;

    const cookie = await autenticar(app, usuario);
    const { body: eu } = await request(app.getHttpServer()).get('/autenticacao/perfil').set('Cookie', cookie);

    await request(app.getHttpServer())
      .patch(`/usuarios/${eu.id}`)
      .set('Cookie', cookie)
      .send({ nome: 'Usuário Editado' })
      .expect(200);
    await request(app.getHttpServer())
      .patch(`/usuarios/${outroUsuarioId}`)
      .set('Cookie', cookie)
      .send({ nome: 'Outro Editado' })
      .expect(403);
    await request(app.getHttpServer())
      .patch(`/usuarios/${eu.id}`)
      .set('Cookie', cookie)
      .send({ tipo: 'ADMIN_LICITACAO' })
      .expect(403);
  });

  it('ao inativar um usuário, o cookie/token dele já emitido perde validade imediatamente', async () => {
    const vitima = {
      nome: 'Vítima',
      email: emailDeTeste('vitima'),
      senha: 'senha12345',
      licitacaoId,
    };
    const respostaCriacao = await request(app.getHttpServer())
      .post('/usuarios')
      .set('Cookie', adminCookie)
      .send(vitima);
    const vitimaId = respostaCriacao.body.id;

    const vitimaCookie = await autenticar(app, vitima);

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
    const cookieLogin = await autenticar(app, usuario);

    const respostaLogout = await request(app.getHttpServer())
      .post('/autenticacao/logout')
      .set('Cookie', cookieLogin)
      .expect(200);

    const cookieLogout = respostaLogout.headers['set-cookie']?.[0] as string;
    expect(cookieLogout).toMatch(/access_token=;/);
  });
});
