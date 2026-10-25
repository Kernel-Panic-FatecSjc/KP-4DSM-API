import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { LeiturasBrutasRepositorio } from '../../servicos/ingestao/leituras-brutas.repositorio';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, criarSessaoDeTeste, PREFIXO_TESTE } from '../helpers';

// Critério de aceite do escopo por licitação: com o banco real, um usuário da
// licitação B recebe 403 ou lista vazia em todas as rotas que tocam dados da A,
// e a Tecsus vê tudo. Uma rota por caso, para a falha dizer qual vazou.
describe('Escopo por licitação (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tecsus: string[];
  let tecsusId: string;
  let adminB: string[];
  let usuarioB: string[];
  const a = { licitacaoId: '', estacaoId: '', vid: '', tipoId: '', alertaId: '', alarmeId: '' };

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    a.licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    const licitacaoB = (await criarLicitacaoDeTeste(app)).id;
    ({ cookie: tecsus, usuarioId: tecsusId } = await criarSessaoDeTeste(app, 'ADMIN_TECSUS'));
    const { cookie: adminA, usuarioId: adminAId } = await criarSessaoDeTeste(app, 'ADMIN_LICITACAO', a.licitacaoId);
    ({ cookie: adminB } = await criarSessaoDeTeste(app, 'ADMIN_LICITACAO', licitacaoB));
    ({ cookie: usuarioB } = await criarSessaoDeTeste(app, 'USUARIO_LICITACAO', licitacaoB));

    // Dados da A, com uma ação auditada do admin dela.
    a.vid = `${PREFIXO_TESTE}escopo-${Date.now()}`;
    const tipo = await prisma.tipoParametro.create({ data: { nome: 'chuva', unidade: 'mm', fator: 1, ganho: 0, licitacaoId: a.licitacaoId } });
    const estacao = await prisma.estacao.create({
      data: { nome: `${PREFIXO_TESTE}Estação A`, endereco: 'R', vid: a.vid, usuarioId: adminAId, licitacaoId: a.licitacaoId },
    });
    const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId: tipo.id } });
    const alerta = await prisma.alerta.create({
      data: { parametroId: parametro.id, operador: 'MAIOR_QUE', valorLimite: 1, severidade: 'ALERTA', licitacaoId: a.licitacaoId },
    });
    await prisma.medida.create({
      data: { valor: 50, unixtime: BigInt(Math.floor(Date.now() / 1000) - 60), parametroId: parametro.id, estacaoId: estacao.id, licitacaoId: a.licitacaoId },
    });
    await new LeiturasBrutasRepositorio(prisma).registrar([
      { id: randomUUID(), vidEstacao: a.vid, payload: { chuva: 50 }, latitude: 0, longitude: 0, unixtimeDispositivo: 1_760_000_000 },
    ]);
    await prisma.leituraErro.create({
      data: {
        leituraBrutaId: randomUUID(), vidEstacao: a.vid, nomeSensor: 'x', valor: 1, unixtime: 1_760_000_000n,
        motivo: 'SENSOR_NAO_CONFIGURADO', licitacaoId: a.licitacaoId,
      },
    });
    await api().patch(`/estacoes/${estacao.id}`).set('Cookie', adminA).send({ endereco: 'Rua A' }).expect(200);
    a.estacaoId = estacao.id;
    a.tipoId = tipo.id;
    a.alertaId = alerta.id;
    a.alarmeId = (await prisma.alarme.findFirstOrThrow({ where: { alertaId: alerta.id } })).id;
  }, 20_000);

  afterAll(async () => {
    await app.close();
  });

  describe('usuário da licitação B consultando a A', () => {
    it.each([
      '/estacoes',
      '/sensores',
      '/alertas',
      '/alarmes',
      '/leituras-brutas',
      '/leituras-erro',
    ])('GET %s não traz nada da A', async (rota) => {
      const resposta = await api().get(rota).set('Cookie', usuarioB).expect(200);
      expect(JSON.stringify(resposta.body)).not.toContain(a.licitacaoId);
      expect(JSON.stringify(resposta.body)).not.toContain(a.vid);
    });

    it.each([
      `/estacoes?licitacaoId=`,
      `/sensores?licitacaoId=`,
      `/alertas?licitacaoId=`,
      `/alarmes?licitacaoId=`,
      `/dashboard?licitacaoId=`,
      `/leituras-brutas?licitacaoId=`,
      `/leituras-erro?licitacaoId=`,
      `/usuarios?licitacaoId=`,
    ])('GET %s<A> responde 403', async (rota) => {
      const cookie = rota.startsWith('/usuarios') ? adminB : usuarioB;
      await api().get(`${rota}${a.licitacaoId}`).set('Cookie', cookie).expect(403);
    });

    it('GET por id de registro da A responde 403', async () => {
      await api().get(`/estacoes/${a.estacaoId}`).set('Cookie', usuarioB).expect(403);
      await api().get(`/licitacoes/${a.licitacaoId}`).set('Cookie', usuarioB).expect(403);
      await api().get(`/licitacoes/${a.licitacaoId}/estacoes`).set('Cookie', usuarioB).expect(403);
    });

    it('o dashboard da B não soma medidas nem alarmes da A', async () => {
      const resposta = await api().get('/dashboard').set('Cookie', usuarioB).expect(200);
      expect(resposta.body.indicadores).toMatchObject({ leituras: 0, alarmesAbertos: 0 });
      expect(resposta.body.estacoes).toEqual([]);
    });

    it('a listagem de licitações traz só a B', async () => {
      const resposta = await api().get('/licitacoes').set('Cookie', usuarioB).expect(200);
      expect(resposta.body.itens.map((item: { id: string }) => item.id)).not.toContain(a.licitacaoId);
      expect(resposta.body.total).toBe(1);
    });

    it('o admin da B não lê a trilha da A nem por filtro', async () => {
      const resposta = await api().get('/auditoria?tamanho=200').set('Cookie', adminB).expect(200);
      expect(resposta.body.itens.every((item: { licitacaoId: string | null }) => item.licitacaoId !== a.licitacaoId)).toBe(true);
      await api().get(`/auditoria?licitacaoId=${a.licitacaoId}`).set('Cookie', adminB).expect(403);
      await api().get('/auditoria').set('Cookie', usuarioB).expect(403);
    });

    it('escritas em registros da A respondem 403 e não mudam nada', async () => {
      await api().patch(`/estacoes/${a.estacaoId}`).set('Cookie', adminB).send({ nome: 'invadida' }).expect(403);
      await api().delete(`/estacoes/${a.estacaoId}`).set('Cookie', adminB).expect(403);
      await api().post(`/estacoes/${a.estacaoId}/chave-ingestao`).set('Cookie', adminB).expect(403);
      await api().patch(`/sensores/${a.tipoId}`).set('Cookie', adminB).send({ ganho: 9 }).expect(403);
      await api().patch(`/alertas/${a.alertaId}`).set('Cookie', adminB).send({ valorLimite: 9 }).expect(403);
      await api().patch(`/alarmes/${a.alarmeId}`).set('Cookie', usuarioB).send({ status: 'RESOLVIDO' }).expect(403);

      expect(await prisma.estacao.findUnique({ where: { id: a.estacaoId } })).toMatchObject({
        nome: `${PREFIXO_TESTE}Estação A`,
        statusOperacional: 'ATIVA',
      });
    });
  });

  describe('a Tecsus vê tudo', () => {
    it('lista os dados da A sem filtro e filtra pela A', async () => {
      const todas = await api().get('/estacoes?tamanho=200').set('Cookie', tecsus).expect(200);
      expect(todas.body.itens.map((item: { id: string }) => item.id)).toContain(a.estacaoId);

      const daA = await api().get(`/estacoes?licitacaoId=${a.licitacaoId}`).set('Cookie', tecsus).expect(200);
      expect(daA.body.itens.map((item: { id: string }) => item.id)).toEqual([a.estacaoId]);

      const dashboard = await api().get(`/dashboard?licitacaoId=${a.licitacaoId}`).set('Cookie', tecsus).expect(200);
      expect(dashboard.body.indicadores.leituras).toBe(1);

      const brutas = await api().get(`/leituras-brutas?licitacaoId=${a.licitacaoId}`).set('Cookie', tecsus).expect(200);
      expect(brutas.body.total).toBe(1);
    });

    it('lê a trilha da A, com a licitação de quem fez a ação', async () => {
      const resposta = await api()
        .get(`/auditoria?licitacaoId=${a.licitacaoId}&acao=estacoes.atualizar`)
        .set('Cookie', tecsus)
        .expect(200);
      expect(resposta.body.itens[0]).toMatchObject({ entidadeId: a.estacaoId, licitacaoId: a.licitacaoId });
    });
  });

  describe('auditoria e exportação', () => {
    // Só as linhas deste usuário: as outras specs rodam em paralelo no mesmo banco.
    const contarTrilha = async () => {
      // o middleware grava no "finish" da resposta, depois de o cliente receber
      await new Promise((resolve) => setTimeout(resolve, 100));
      return prisma.logAuditoria.count({ where: { usuarioId: tecsusId } });
    };

    it('abrir a tela de auditoria não cria linha nova na trilha', async () => {
      const antes = await contarTrilha();
      await api().get('/auditoria').set('Cookie', tecsus).expect(200);
      await api().get('/auditoria?pagina=2&acao=x').set('Cookie', tecsus).expect(200);
      expect(await contarTrilha()).toBe(antes);
    });

    it('exportar exige período (400 em JSON, antes de começar o arquivo)', async () => {
      const brutas = await api().get('/leituras-brutas/exportar').set('Cookie', tecsus).expect(400);
      expect(brutas.body.message).toMatch(/período/);
      await api().get('/auditoria/exportar?de=2026-01-01').set('Cookie', tecsus).expect(400);
    });

    it('exporta o CSV das leituras brutas no escopo de quem pede, com uma coluna por sensor', async () => {
      const periodo = 'de=2026-01-01T00:00:00.000Z&ate=2099-01-01T00:00:00.000Z';

      const daA = await api().get(`/leituras-brutas/exportar?${periodo}&licitacaoId=${a.licitacaoId}`).set('Cookie', tecsus).expect(200);
      expect(daA.headers['content-type']).toContain('text/csv');
      const linhas = daA.text.split('\r\n').filter(Boolean);
      expect(linhas[0]).toBe('﻿ID da leitura;VID da estação;Recebida em;Unix time do dispositivo;Latitude;Longitude;Leitura: chuva');
      expect(linhas).toHaveLength(2);
      expect(linhas[1]).toContain(a.vid);

      const daB = await api().get(`/leituras-brutas/exportar?${periodo}`).set('Cookie', usuarioB).expect(200);
      expect(daB.text).not.toContain(a.vid);
    });

    it('exporta a trilha em CSV e registra a exportação', async () => {
      const resposta = await api()
        .get('/auditoria/exportar?de=2026-01-01T00:00:00.000Z&ate=2099-01-01T00:00:00.000Z')
        .set('Cookie', tecsus)
        .expect(200);

      expect(resposta.text.split('\r\n')[0]).toBe('﻿Data/hora;Usuário;Ação;Entidade;ID da entidade;Licitação;Detalhes');
      expect(await prisma.logAuditoria.count({ where: { acao: 'auditoria.exportar' } })).toBeGreaterThan(0);
    });
  });
});
