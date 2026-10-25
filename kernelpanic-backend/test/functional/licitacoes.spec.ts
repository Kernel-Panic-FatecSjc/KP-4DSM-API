import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, criarSessaoDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

const codigoUnico = () => `L-${Date.now().toString(36).toUpperCase()}${Math.floor(Math.random() * 1e4)}`;

const novaLicitacao = (codigo = codigoUnico()) => ({
  codigoIdentificador: codigo.toLowerCase(),
  numeroProcesso: `P-${codigo}`,
  modalidade: 'PREGAO',
  objeto: 'Monitoramento pluviométrico',
  numeroContrato: `C-${codigo}`,
  inicioVigencia: '2026-01-01',
  fimVigencia: '2099-12-31',
  status: 'VIGENTE',
  orgaoNome: 'Prefeitura de teste',
  orgaoCnpj: '11.222.333/0001-81',
  orgaoEsfera: 'MUNICIPAL',
  orgaoMunicipio: 'São José dos Campos',
  orgaoUf: 'sp',
});

// Com o banco real: cadastro, ciclo de vida e transferência de estações.
describe('Licitações (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let tecsus: string[];
  let tecsusId: string;

  const api = () => request(app.getHttpServer());

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    ({ cookie: tecsus, usuarioId: tecsusId } = await criarSessaoDeTeste(app, 'ADMIN_TECSUS'));
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  it('a Tecsus cadastra a licitação com contrato e órgão, normalizando código, UF e CNPJ, e audita', async () => {
    const dados = novaLicitacao();
    const resposta = await api().post('/licitacoes').set('Cookie', tecsus).send(dados).expect(201);

    expect(resposta.body).toMatchObject({
      codigoIdentificador: dados.codigoIdentificador.toUpperCase(),
      status: 'VIGENTE',
      orgaoUf: 'SP',
      orgaoCnpj: '11222333000181',
      encerradaEm: null,
    });
    const auditoria = await prisma.logAuditoria.findFirst({ where: { acao: 'licitacoes.criar', entidadeId: resposta.body.id } });
    expect(auditoria).toMatchObject({ usuarioId: tecsusId, licitacaoId: null });
  });

  it('responde 409 para código, processo ou contrato repetido', async () => {
    const dados = novaLicitacao();
    await api().post('/licitacoes').set('Cookie', tecsus).send(dados).expect(201);

    const resposta = await api()
      .post('/licitacoes')
      .set('Cookie', tecsus)
      .send({ ...novaLicitacao(), numeroContrato: dados.numeroContrato })
      .expect(409);
    expect(resposta.body.message).toBe('Já existe uma licitação com este número de contrato');
  });

  it('rejeita dados inválidos com 400', async () => {
    await api().post('/licitacoes').set('Cookie', tecsus).send({}).expect(400);
    await api().post('/licitacoes').set('Cookie', tecsus).send({ ...novaLicitacao(), orgaoCnpj: '11.111.111/1111-11' }).expect(400);
    await api().post('/licitacoes').set('Cookie', tecsus).send({ ...novaLicitacao(), codigoIdentificador: 'com espaço' }).expect(400);
    await api().post('/licitacoes').set('Cookie', tecsus).send({ ...novaLicitacao(), fimVigencia: '2025-01-01' }).expect(400);
  });

  it('lista com filtro, busca e paginação', async () => {
    const dados = novaLicitacao();
    await api().post('/licitacoes').set('Cookie', tecsus).send({ ...dados, status: 'RASCUNHO' }).expect(201);

    const resposta = await api()
      .get('/licitacoes')
      .query({ busca: dados.numeroProcesso, status: 'RASCUNHO', tamanho: 5 })
      .set('Cookie', tecsus)
      .expect(200);

    expect(resposta.body).toMatchObject({ total: 1, pagina: 1, tamanho: 5 });
    expect(resposta.body.itens[0]).toMatchObject({ numeroProcesso: dados.numeroProcesso, quantidadeEstacoes: 0 });
  });

  it('só a Tecsus cadastra, edita e encerra', async () => {
    const { id } = await criarLicitacaoDeTeste(app);
    const { cookie: admin } = await criarSessaoDeTeste(app, 'ADMIN_LICITACAO', id);

    await api().post('/licitacoes').set('Cookie', admin).send(novaLicitacao()).expect(403);
    await api().patch(`/licitacoes/${id}`).set('Cookie', admin).send({ objeto: 'x' }).expect(403);
    await api().patch(`/licitacoes/${id}/encerrar`).set('Cookie', admin).expect(403);
    await api().get(`/licitacoes/${id}`).set('Cookie', admin).expect(200);
  });

  describe('encerramento', () => {
    it('inativa estações e alertas, deixa os usuários só lendo e trava a licitação', async () => {
      const { id } = await criarLicitacaoDeTeste(app);
      const { cookie: admin, usuarioId: adminId } = await criarSessaoDeTeste(app, 'ADMIN_LICITACAO', id);
      const tipo = await prisma.tipoParametro.create({ data: { nome: 'chuva', unidade: 'mm', fator: 1, ganho: 0, licitacaoId: id } });
      const estacao = await prisma.estacao.create({
        data: { nome: 'E', endereco: 'R', vid: `${PREFIXO_TESTE}enc-${Date.now()}`, usuarioId: adminId, licitacaoId: id },
      });
      const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId: tipo.id } });
      const alerta = await prisma.alerta.create({
        data: { parametroId: parametro.id, operador: 'MAIOR_QUE', valorLimite: 1, severidade: 'ALERTA', licitacaoId: id },
      });

      const resposta = await api().patch(`/licitacoes/${id}/encerrar`).set('Cookie', tecsus).expect(200);

      expect(resposta.body).toMatchObject({ status: 'ENCERRADA' });
      expect(resposta.body.encerradaEm).toBeTruthy();
      expect(await prisma.estacao.findUnique({ where: { id: estacao.id } })).toMatchObject({ statusOperacional: 'INATIVA' });
      expect(await prisma.alerta.findUnique({ where: { id: alerta.id } })).toMatchObject({ ativo: false });

      // Os usuários dela entram e leem, mas não escrevem.
      const perfil = await api().get('/autenticacao/perfil').set('Cookie', admin).expect(200);
      expect(perfil.body.somenteLeitura).toBe(true);
      await api().get('/estacoes').set('Cookie', admin).expect(200);
      const escrita = await api().patch(`/estacoes/${estacao.id}`).set('Cookie', admin).send({ nome: 'X' }).expect(403);
      expect(escrita.body.message).toMatch(/somente leitura/);
      await api()
        .post('/usuarios')
        .set('Cookie', admin)
        .send({ nome: 'X', email: emailDeTeste('x'), senha: 'senha12345' })
        .expect(403);

      // A licitação encerrada não muda, não reencerra e não recebe estação nova.
      await api().patch(`/licitacoes/${id}`).set('Cookie', tecsus).send({ objeto: 'x' }).expect(400);
      await api().patch(`/licitacoes/${id}/encerrar`).set('Cookie', tecsus).expect(400);
      await api()
        .post('/estacoes')
        .set('Cookie', tecsus)
        .send({ nome: 'N', endereco: 'R', vid: '11:22:33:44:55:01', latitude: 0, longitude: 0, licitacaoId: id })
        .expect(400);
    });

    it('segue as transições do contrato: suspensa volta a vigente, rascunho não volta', async () => {
      const { id } = await criarLicitacaoDeTeste(app);

      await api().patch(`/licitacoes/${id}`).set('Cookie', tecsus).send({ status: 'SUSPENSA' }).expect(200);
      await api().patch(`/licitacoes/${id}`).set('Cookie', tecsus).send({ status: 'RASCUNHO' }).expect(400);
      await api().patch(`/licitacoes/${id}`).set('Cookie', tecsus).send({ status: 'VIGENTE' }).expect(200);
      await api().patch(`/licitacoes/${id}`).set('Cookie', tecsus).send({ status: 'ENCERRADA' }).expect(400);
    });
  });

  describe('vínculo (transferência) de estações', () => {
    it('muda a estação de licitação, troca os tipos pelos de mesmo nome e inativa os alertas da origem; o histórico fica com a origem', async () => {
      const origem = (await criarLicitacaoDeTeste(app)).id;
      const destino = (await criarLicitacaoDeTeste(app)).id;
      const tipoOrigem = await prisma.tipoParametro.create({ data: { nome: 'Chuva', unidade: 'mm', fator: 1, ganho: 0, licitacaoId: origem } });
      const tipoDestino = await prisma.tipoParametro.create({ data: { nome: 'chuva', unidade: 'mm', fator: 1, ganho: 0, licitacaoId: destino } });
      const estacao = await prisma.estacao.create({
        data: { nome: 'E', endereco: 'R', vid: `${PREFIXO_TESTE}vinc-${Date.now()}`, usuarioId: tecsusId, licitacaoId: origem },
      });
      const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId: tipoOrigem.id } });
      const alerta = await prisma.alerta.create({
        data: { parametroId: parametro.id, operador: 'MAIOR_QUE', valorLimite: 1, severidade: 'ALERTA', licitacaoId: origem },
      });
      const medida = await prisma.medida.create({
        data: { valor: 1, unixtime: 1_760_000_000n, parametroId: parametro.id, estacaoId: estacao.id, licitacaoId: origem },
      });

      const resposta = await api()
        .post(`/licitacoes/${destino}/estacoes`)
        .set('Cookie', tecsus)
        .send({ estacaoIds: [estacao.id] })
        .expect(201);

      expect(resposta.body).toEqual({ licitacaoId: destino, estacoesVinculadas: 1, alertasInativados: 1 });
      expect(await prisma.estacao.findUnique({ where: { id: estacao.id } })).toMatchObject({ licitacaoId: destino });
      expect(await prisma.parametro.findUnique({ where: { id: parametro.id } })).toMatchObject({ tipoParametroId: tipoDestino.id });
      expect(await prisma.alerta.findUnique({ where: { id: alerta.id } })).toMatchObject({ ativo: false, licitacaoId: origem });
      expect(await prisma.medida.findUnique({ where: { id: medida.id } })).toMatchObject({ licitacaoId: origem });

      const hierarquia = await api().get(`/licitacoes/${destino}/estacoes`).set('Cookie', tecsus).expect(200);
      expect(hierarquia.body).toEqual([expect.objectContaining({ id: estacao.id, sensores: [expect.objectContaining({ id: tipoDestino.id })] })]);
    });

    it('recusa com 400, listando o sensor, quando o destino não tem o tipo usado pela estação', async () => {
      const origem = (await criarLicitacaoDeTeste(app)).id;
      const destino = (await criarLicitacaoDeTeste(app)).id;
      const tipo = await prisma.tipoParametro.create({ data: { nome: 'Vento', unidade: 'm/s', fator: 1, ganho: 0, licitacaoId: origem } });
      const estacao = await prisma.estacao.create({
        data: { nome: 'E', endereco: 'R', vid: `${PREFIXO_TESTE}semtipo-${Date.now()}`, usuarioId: tecsusId, licitacaoId: origem },
      });
      await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId: tipo.id } });

      const resposta = await api()
        .post(`/licitacoes/${destino}/estacoes`)
        .set('Cookie', tecsus)
        .send({ estacaoIds: [estacao.id] })
        .expect(400);

      expect(resposta.body.message).toContain('Vento');
      expect(await prisma.estacao.findUnique({ where: { id: estacao.id } })).toMatchObject({ licitacaoId: origem });
    });
  });

  it('o banco barra sensor de outra licitação mesmo fora da API (trigger de consistência)', async () => {
    const a = (await criarLicitacaoDeTeste(app)).id;
    const b = (await criarLicitacaoDeTeste(app)).id;
    const tipoDeB = await prisma.tipoParametro.create({ data: { nome: 'x', unidade: 'mm', fator: 1, ganho: 0, licitacaoId: b } });
    const estacaoDeA = await prisma.estacao.create({
      data: { nome: 'E', endereco: 'R', vid: `${PREFIXO_TESTE}trig-${Date.now()}`, usuarioId: tecsusId, licitacaoId: a },
    });

    await expect(prisma.parametro.create({ data: { estacaoId: estacaoDeA.id, tipoParametroId: tipoDeB.id } })).rejects.toThrow(
      'não é da licitação da estação',
    );
  });
});
