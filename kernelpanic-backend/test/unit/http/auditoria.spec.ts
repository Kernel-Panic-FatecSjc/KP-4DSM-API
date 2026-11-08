import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { criarAppDeTeste } from '../../helpers';
import { LICITACAO_A, LICITACAO_B } from '../sessoes';

const TECSUS = { id: 'tecsus-1', email: 'tecsus@teste.com', tipo: 'ADMIN_TECSUS', licitacaoId: null, licitacao: null, ativo: true };
const ADMIN_A = {
  id: 'admin-a',
  email: 'admin-a@teste.com',
  tipo: 'ADMIN_LICITACAO',
  licitacaoId: LICITACAO_A,
  licitacao: { status: 'VIGENTE' },
  ativo: true,
};
const USUARIO_A = { ...ADMIN_A, id: 'usuario-a', email: 'usuario-a@teste.com', tipo: 'USUARIO_LICITACAO' };

const REGISTROS = [
  {
    id: 'registro-2',
    criadoEm: new Date('2026-10-18T15:30:00.000Z'),
    acao: 'usuarios.criar',
    entidade: 'Usuario',
    entidadeId: 'usuario-9',
    enderecoIp: '177.10.20.30',
    detalhes: { nome: 'Ana', senha: 'nunca-sai' },
    licitacaoId: LICITACAO_A,
    usuario: { id: ADMIN_A.id, nome: 'Admin A' },
  },
  {
    id: 'registro-1',
    criadoEm: new Date('2026-10-18T15:00:00.000Z'),
    acao: 'acesso.http',
    entidade: '/auditoria',
    entidadeId: null,
    enderecoIp: '198.51.100.7',
    detalhes: { metodo: 'GET', status: 403, autenticado: true },
    licitacaoId: LICITACAO_A,
    usuario: { id: USUARIO_A.id, nome: 'Usuário A' },
  },
];

const PERIODO = { de: '2026-10-01T00:00:00.000Z', ate: '2026-10-31T23:59:59.999Z' };

describe('GET /auditoria e /auditoria/exportar', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const usuario = { findUnique: jest.fn() };
  const logAuditoria = { create: jest.fn(), findMany: jest.fn(), count: jest.fn() };

  const como = (u: { id: string; email: string }) => {
    usuario.findUnique.mockResolvedValue(u);
    return `access_token=${jwt.sign({ sub: u.id, email: u.email })}`;
  };
  const get = (caminho: string, cookie: string, query: Record<string, string> = {}) =>
    request(app.getHttpServer()).get(caminho).query(query).set('Cookie', cookie);
  /** O middleware de acesso registra no 'finish' da resposta. */
  const esperarFinish = () => new Promise((resolve) => setTimeout(resolve, 50));
  const acoesRegistradas = () => logAuditoria.create.mock.calls.map(([argumento]) => argumento.data.acao);

  beforeAll(async () => {
    app = await criarAppDeTeste({ prismaMock: { usuario, logAuditoria, $connect: jest.fn(), $disconnect: jest.fn() } });
    jwt = app.get(JwtService);
  }, 60_000);

  beforeEach(() => {
    jest.clearAllMocks();
    logAuditoria.create.mockResolvedValue({});
    logAuditoria.count.mockResolvedValue(REGISTROS.length);
    // Exportação em lotes: devolve tudo no primeiro e nada depois.
    logAuditoria.findMany.mockResolvedValueOnce(REGISTROS).mockResolvedValue([]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('o usuário comum da licitação recebe 403 na consulta e na exportação, e a tentativa é registrada com IP', async () => {
    const cookie = como(USUARIO_A);
    await get('/auditoria', cookie).expect(403);
    await get('/auditoria/exportar', cookie, PERIODO).expect(403);
    await esperarFinish();

    expect(logAuditoria.findMany).not.toHaveBeenCalled();
    const negadas = logAuditoria.create.mock.calls.map(([argumento]) => argumento.data).filter((dados) => dados.acao === 'acesso.http');
    expect(negadas).toHaveLength(2);
    for (const dados of negadas) {
      expect(dados).toMatchObject({ usuarioId: USUARIO_A.id, detalhes: { status: 403, autenticado: true } });
      expect(dados.enderecoIp).toBeTruthy();
    }
  });

  it('sem login: 401, também registrado', async () => {
    await request(app.getHttpServer()).get('/auditoria').expect(401);
    await esperarFinish();
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ acao: 'acesso.http', detalhes: { metodo: 'GET', status: 401, autenticado: false } }),
    });
  });

  it('o admin da licitação lê só a própria trilha; pedir outra é 403', async () => {
    const cookie = como(ADMIN_A);
    await get('/auditoria', cookie).expect(200);
    expect(logAuditoria.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);

    await get('/auditoria', cookie, { licitacaoId: LICITACAO_B }).expect(403);
  });

  it('a consulta bem-sucedida da trilha não gera registro novo', async () => {
    const resposta = await get('/auditoria', como(TECSUS), { acao: 'usuarios' }).expect(200);
    await esperarFinish();

    expect(resposta.body.total).toBe(2);
    expect(logAuditoria.create).not.toHaveBeenCalled();
  });

  it('o CSV traz os mesmos registros e campos da consulta filtrada, com IP mascarado e sem dados sensíveis', async () => {
    const cookie = como(TECSUS);
    const consulta = await get('/auditoria', cookie, { ...PERIODO, acao: 'usuarios' }).expect(200);
    logAuditoria.findMany.mockReset().mockResolvedValueOnce(REGISTROS).mockResolvedValue([]);
    const exportacao = await get('/auditoria/exportar', cookie, { ...PERIODO, acao: 'usuarios' }).expect(200);

    // Mesmo filtro nas duas consultas ao banco (a exportação só acrescenta o keyset).
    const filtroConsulta = logAuditoria.findMany.mock.calls[0][0].where.AND[0];
    expect(filtroConsulta.acao).toEqual({ contains: 'usuarios', mode: 'insensitive' });

    const linhas = exportacao.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(linhas[0]).toBe('ID do registro;Data/hora;ID do usuário;Usuário;Ação;Entidade;ID da entidade;IP de origem (mascarado);Licitação;Detalhes');
    expect(linhas.slice(1).map((linha) => linha.split(';')[0])).toEqual(consulta.body.itens.map((item: { id: string }) => item.id));
    expect(linhas[1]).toContain(';177.10.*.*;');
    expect(exportacao.text).not.toContain('nunca-sai');
    expect(exportacao.text).not.toContain('177.10.20.30');
    expect(acoesRegistradas()).toContain('auditoria.exportar');
  });

  it('recusa com 422 a exportação de um filtro sem registro, sem registrar exportação', async () => {
    logAuditoria.findMany.mockReset().mockResolvedValue([]);

    const resposta = await get('/auditoria/exportar', como(TECSUS), PERIODO).expect(422);
    await esperarFinish();

    expect(resposta.headers['content-type']).toContain('application/json');
    expect(resposta.body.message).toContain('Nenhum registro');
    expect(acoesRegistradas()).not.toContain('auditoria.exportar');
  });

  it('exportar sem período continua 400', async () => {
    await get('/auditoria/exportar', como(TECSUS), { de: PERIODO.de }).expect(400);
  });
});
