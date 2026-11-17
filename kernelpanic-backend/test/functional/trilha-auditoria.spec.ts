import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, criarSessaoDeTeste } from '../helpers';

// Validação da trilha de auditoria com o banco real (US17, SCRUM-146):
// imutabilidade dentro e fora da API, acessos negados com IP, consulta que não
// gera registro e exportação igual à consulta filtrada.
describe('Trilha de auditoria (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tecsus: string[];
  let adminA: string[];
  let usuarioA: string[];
  let usuarioAId: string;
  let licitacaoA: string;
  let registroId: string;
  const marca = `trilha-${Date.now()}`;

  const api = () => request(app.getHttpServer());
  const contar = () => prisma.logAuditoria.count();
  /** O middleware de acesso grava no 'finish' da resposta, sem segurar o retorno. */
  const esperarGravacao = () => new Promise((resolve) => setTimeout(resolve, 200));

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    licitacaoA = (await criarLicitacaoDeTeste(app)).id;
    tecsus = (await criarSessaoDeTeste(app, 'ADMIN_TECSUS')).cookie;
    adminA = (await criarSessaoDeTeste(app, 'ADMIN_LICITACAO', licitacaoA)).cookie;
    const sessao = await criarSessaoDeTeste(app, 'USUARIO_LICITACAO', licitacaoA);
    usuarioA = sessao.cookie;
    usuarioAId = sessao.usuarioId;

    registroId = (
      await prisma.logAuditoria.create({
        data: { acao: `${marca}.criar`, entidade: 'Teste', entidadeId: 'alvo-1', enderecoIp: '177.10.20.30', licitacaoId: licitacaoA },
      })
    ).id;
    await prisma.logAuditoria.createMany({
      data: [
        { acao: `${marca}.atualizar`, entidade: 'Teste', entidadeId: 'alvo-1', licitacaoId: licitacaoA },
        { acao: `${marca}.atualizar`, entidade: 'Teste', entidadeId: 'alvo-2', licitacaoId: licitacaoA },
      ],
    });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  describe('imutabilidade no banco (RNF14.5)', () => {
    it('recusa UPDATE, DELETE e TRUNCATE, mesmo fora da API', async () => {
      await expect(prisma.logAuditoria.update({ where: { id: registroId }, data: { acao: 'adulterada' } })).rejects.toThrow(
        'Registros de auditoria são imutáveis',
      );
      await expect(prisma.logAuditoria.delete({ where: { id: registroId } })).rejects.toThrow('Registros de auditoria são imutáveis');
      await expect(prisma.$executeRawUnsafe('DELETE FROM logs_auditoria')).rejects.toThrow('Registros de auditoria são imutáveis');

      const antes = await contar();
      await expect(prisma.$executeRawUnsafe('TRUNCATE logs_auditoria')).rejects.toThrow('Registros de auditoria são imutáveis');
      expect(await contar()).toBe(antes);
      await expect(prisma.logAuditoria.findUnique({ where: { id: registroId } })).resolves.toMatchObject({ acao: `${marca}.criar` });
    });

    it('a API não tem rota que altere ou apague a trilha', async () => {
      await api().patch(`/auditoria/${registroId}`).set('Cookie', tecsus).send({ acao: 'x' }).expect(404);
      await api().delete(`/auditoria/${registroId}`).set('Cookie', tecsus).expect(404);
      await expect(prisma.logAuditoria.findUnique({ where: { id: registroId } })).resolves.toMatchObject({ acao: `${marca}.criar` });
    });
  });

  describe('acesso à trilha (RNF14.6) e acessos negados (RNF14.4)', () => {
    it('o usuário comum recebe 403, e a tentativa fica registrada com usuário e IP', async () => {
      await api().get('/auditoria').set('Cookie', usuarioA).expect(403);
      await esperarGravacao();

      const negada = await prisma.logAuditoria.findFirst({
        where: { acao: 'acesso.http', entidade: '/auditoria', usuarioId: usuarioAId },
        orderBy: { criadoEm: 'desc' },
      });
      expect(negada).toMatchObject({ detalhes: { metodo: 'GET', status: 403, autenticado: true } });
      expect(negada?.enderecoIp).toBeTruthy();
    });

    it('sem login, a tentativa é 401 e fica registrada com IP', async () => {
      const antes = await prisma.logAuditoria.count({ where: { acao: 'acesso.http', entidade: '/auditoria/exportar', usuarioId: null } });
      await api().get('/auditoria/exportar').expect(401);
      await esperarGravacao();

      const negadas = await prisma.logAuditoria.findMany({
        where: { acao: 'acesso.http', entidade: '/auditoria/exportar', usuarioId: null },
        orderBy: { criadoEm: 'desc' },
      });
      expect(negadas).toHaveLength(antes + 1);
      expect(negadas[0]).toMatchObject({ detalhes: { status: 401, autenticado: false } });
      expect(negadas[0].enderecoIp).toBeTruthy();
    });

    it('a consulta da trilha (Tecsus e admin da licitação) não gera registro novo', async () => {
      const antes = await contar();
      await api().get('/auditoria').query({ acao: marca }).set('Cookie', tecsus).expect(200);
      await api().get('/auditoria').set('Cookie', adminA).expect(200);
      await esperarGravacao();
      expect(await contar()).toBe(antes);
    });
  });

  describe('registro das ações (RNF14.3)', () => {
    it('cada ação de negócio guarda quem, quando, o quê e o registro afetado', async () => {
      const criado = await api()
        .post('/sensores')
        .set('Cookie', adminA)
        .send({ nome: `Sensor ${marca}`, unidade: 'mm', fator: 1, ganho: 0 })
        .expect(201);

      const registro = await prisma.logAuditoria.findFirst({ where: { acao: 'sensores.criar', entidadeId: criado.body.id } });
      expect(registro).toMatchObject({ entidade: 'TipoParametro', licitacaoId: licitacaoA });
      expect(registro?.usuarioId).toBeTruthy();
      expect(registro?.criadoEm).toBeInstanceOf(Date);
    });
  });

  describe('exportação (RNF14.7)', () => {
    const periodo = { de: '2026-01-01T00:00:00.000Z', ate: '2099-12-31T23:59:59.999Z' };

    it('o CSV traz exatamente os registros da consulta com o mesmo filtro', async () => {
      const filtro = { ...periodo, acao: marca, tamanho: '200' };
      const consulta = await api().get('/auditoria').query(filtro).set('Cookie', tecsus).expect(200);
      const exportacao = await api().get('/auditoria/exportar').query(filtro).set('Cookie', tecsus).expect(200);

      const linhas = exportacao.text.replace(/^﻿/, '').trim().split('\r\n').slice(1);
      expect(consulta.body.total).toBe(3);
      expect(linhas.map((linha) => linha.split(';')[0])).toEqual(consulta.body.itens.map((item: { id: string }) => item.id));
      expect(exportacao.text).toContain('177.10.*.*');
      expect(exportacao.text).not.toContain('177.10.20.30');
      expect(await prisma.logAuditoria.count({ where: { acao: 'auditoria.exportar' } })).toBeGreaterThan(0);
    });

    it('recusa com 422 o filtro sem registro, sem registrar exportação', async () => {
      const antes = await prisma.logAuditoria.count({ where: { acao: 'auditoria.exportar' } });
      const resposta = await api()
        .get('/auditoria/exportar')
        .query({ ...periodo, acao: `${marca}-inexistente` })
        .set('Cookie', tecsus)
        .expect(422);

      expect(resposta.body.message).toContain('Nenhum registro');
      expect(await prisma.logAuditoria.count({ where: { acao: 'auditoria.exportar' } })).toBe(antes);
    });
  });
});
