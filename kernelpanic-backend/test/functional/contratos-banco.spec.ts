import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarSessaoDeTeste, gerarCnpj } from '../helpers';

// Com o banco real: unicidade do número (inclusive em corrida), vigência,
// transições de status, imutabilidade do encerrado, filtros e paginação da
// listagem, contagem de estações e auditoria gravada. Os dados levam um
// rótulo único da execução, então as suítes funcionais podem rodar em
// paralelo sem se atrapalhar.
describe('Contratos com banco real (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Awaited<ReturnType<typeof criarSessaoDeTeste>>;
  let monitor: Awaited<ReturnType<typeof criarSessaoDeTeste>>;
  let orgaoId: string;
  let outroOrgaoId: string;
  let orgaoInativoId: string;

  const rotulo = randomUUID().slice(0, 8);
  let sequencia = 0;
  const numero = (sufixo = '') => `CTR-${rotulo}-${++sequencia}${sufixo}`;
  const dados = (extra: Record<string, unknown> = {}) => ({
    numero: numero(),
    objeto: `Monitoramento ${rotulo}`,
    inicioVigencia: '2026-01-01',
    fimVigencia: '2099-12-31',
    orgaoId,
    ...extra,
  });
  const criar = (corpo: Record<string, unknown>, cookie = admin.cookie) =>
    request(app.getHttpServer()).post('/contratos').set('Cookie', cookie).send(corpo);
  const editar = (id: string, corpo: Record<string, unknown>, cookie = admin.cookie) =>
    request(app.getHttpServer()).patch(`/contratos/${id}`).set('Cookie', cookie).send(corpo);
  const encerrar = (id: string, cookie = admin.cookie) =>
    request(app.getHttpServer()).patch(`/contratos/${id}/encerrar`).set('Cookie', cookie);
  const auditorias = (acao: string, entidadeId: string) =>
    prisma.logAuditoria.findMany({ where: { acao, entidadeId } });
  const contarPorNumero = (valor: string) => prisma.contrato.count({ where: { numero: valor } });

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    admin = await criarSessaoDeTeste(app, 'ADMINISTRADOR');
    monitor = await criarSessaoDeTeste(app, 'MONITOR');

    const orgao = (sufixo: string, extra: object = {}) =>
      prisma.orgaoPublico.create({
        data: {
          nome: `Órgão ${rotulo} ${sufixo}`,
          cnpj: gerarCnpj(),
          esfera: 'MUNICIPAL',
          municipio: 'São José dos Campos',
          uf: 'SP',
          ...extra,
        },
      });
    orgaoId = (await orgao('principal')).id;
    outroOrgaoId = (await orgao('outro')).id;
    orgaoInativoId = (await orgao('inativo', { ativo: false })).id;
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  describe('permissões', () => {
    it('devolve 401 sem login em todas as rotas', async () => {
      const http = request(app.getHttpServer());
      const id = randomUUID();
      await http.get('/contratos').expect(401);
      await http.get(`/contratos/${id}`).expect(401);
      await http.get(`/contratos/${id}/estacoes`).expect(401);
      await http.post('/contratos').send(dados()).expect(401);
      await http.patch(`/contratos/${id}`).send({ objeto: 'x' }).expect(401);
      await http.patch(`/contratos/${id}/encerrar`).expect(401);
    });

    it('devolve 403 ao MONITOR nas rotas de escrita, sem gravar nem auditar, e deixa ele consultar', async () => {
      const { body: existente } = await criar(dados({ numero: numero('-monitor') })).expect(201);
      const tentativa = dados();

      await criar(tentativa, monitor.cookie).expect(403);
      await editar(existente.id, { objeto: 'Alterado pelo monitor' }, monitor.cookie).expect(403);
      await encerrar(existente.id, monitor.cookie).expect(403);

      expect(await contarPorNumero(tentativa.numero)).toBe(0);
      expect(await prisma.contrato.findUniqueOrThrow({ where: { id: existente.id } })).toMatchObject({
        objeto: `Monitoramento ${rotulo}`,
        status: 'RASCUNHO',
        encerradoEm: null,
      });
      expect(await auditorias('contratos.atualizar', existente.id)).toHaveLength(0);
      expect(await auditorias('contratos.encerrar', existente.id)).toHaveLength(0);

      const http = request(app.getHttpServer());
      await http.get('/contratos').set('Cookie', monitor.cookie).expect(200);
      await http.get(`/contratos/${existente.id}`).set('Cookie', monitor.cookie).expect(200);
      await http.get(`/contratos/${existente.id}/estacoes`).set('Cookie', monitor.cookie).expect(200);
    });
  });

  describe('cadastro', () => {
    it('cria como rascunho, normaliza a vigência ao dia inteiro (UTC) e registra a auditoria', async () => {
      const corpo = dados();

      const { body } = await criar(corpo).expect(201);

      expect(body).toMatchObject({
        numero: corpo.numero,
        status: 'RASCUNHO',
        encerradoEm: null,
        inicioVigencia: '2026-01-01T00:00:00.000Z',
        fimVigencia: '2099-12-31T23:59:59.999Z',
        orgao: { id: orgaoId },
      });
      const [registro] = await auditorias('contratos.criar', body.id);
      expect(registro).toMatchObject({ entidade: 'Contrato', usuarioId: admin.usuarioId });
      expect(registro.detalhes).toMatchObject({ numero: corpo.numero, orgaoId, status: 'RASCUNHO' });
    });

    it('aceita fim igual ao início (vigência de um dia)', async () => {
      await criar(dados({ inicioVigencia: '2026-05-10', fimVigencia: '2026-05-10' })).expect(201);
    });

    it('recusa número já cadastrado com 409, sem duplicar nem auditar', async () => {
      const corpo = dados();
      const { body: original } = await criar(corpo).expect(201);

      await criar({ ...corpo, objeto: 'Outro objeto' }).expect(409);

      expect(await contarPorNumero(corpo.numero)).toBe(1);
      const duplicado = await prisma.logAuditoria.count({
        where: { acao: 'contratos.criar', detalhes: { path: ['numero'], equals: corpo.numero } },
      });
      expect(duplicado).toBe(1);
      expect(await auditorias('contratos.criar', original.id)).toHaveLength(1);
    });

    it('com cadastros simultâneos do mesmo número, só um entra e os demais recebem 409 (nunca 500)', async () => {
      const corpo = dados();

      const respostas = await Promise.all(Array.from({ length: 8 }, () => criar(corpo)));

      const status = respostas.map((resposta) => resposta.status);
      expect(status.filter((codigo) => codigo === 201)).toHaveLength(1);
      expect(status.filter((codigo) => codigo === 409)).toHaveLength(7);
      expect(await contarPorNumero(corpo.numero)).toBe(1);
    });

    it('recusa vigência invertida com 400, sem gravar', async () => {
      const corpo = dados({ inicioVigencia: '2027-01-01', fimVigencia: '2026-12-31' });

      await criar(corpo).expect(400);

      expect(await contarPorNumero(corpo.numero)).toBe(0);
    });

    it('recusa órgão inexistente e órgão inativo com 400, sem gravar', async () => {
      const inexistente = dados({ orgaoId: randomUUID() });
      const inativo = dados({ orgaoId: orgaoInativoId });

      await criar(inexistente).expect(400);
      await criar(inativo).expect(400);

      expect(await contarPorNumero(inexistente.numero)).toBe(0);
      expect(await contarPorNumero(inativo.numero)).toBe(0);
    });

    it('recusa contrato já vigente com a vigência expirada', async () => {
      const corpo = dados({ fimVigencia: '2020-01-01', inicioVigencia: '2019-01-01', status: 'VIGENTE' });

      await criar(corpo).expect(400);

      expect(await contarPorNumero(corpo.numero)).toBe(0);
    });

    it.each([
      ['número vazio', { numero: '' }],
      ['objeto vazio', { objeto: '' }],
      ['data de início inválida', { inicioVigencia: 'ontem' }],
      ['data de fim ausente', { fimVigencia: undefined }],
      ['status inexistente', { status: 'ABERTO' }],
      ['órgão ausente', { orgaoId: undefined }],
    ])('recusa com 400 %s', async (_descricao, alteracao) => {
      const corpo = dados(alteracao);

      await criar(corpo).expect(400);

      expect(await contarPorNumero(corpo.numero)).toBe(0);
    });
  });

  describe('edição, status e encerramento', () => {
    it('edita campos, audita só os informados e mantém o resto', async () => {
      const { body } = await criar(dados()).expect(201);

      const resposta = await editar(body.id, { objeto: 'Objeto revisado', orgaoId: outroOrgaoId }).expect(200);

      expect(resposta.body).toMatchObject({ objeto: 'Objeto revisado', numero: body.numero, orgao: { id: outroOrgaoId } });
      const [registro] = await auditorias('contratos.atualizar', body.id);
      expect(registro.detalhes).toMatchObject({ campos: ['objeto', 'orgaoId'] });
    });

    it('recusa número de outro contrato com 409 e vigência invertida com 400, sem alterar', async () => {
      const { body: a } = await criar(dados()).expect(201);
      const { body: b } = await criar(dados()).expect(201);

      await editar(b.id, { numero: a.numero }).expect(409);
      await editar(b.id, { fimVigencia: '2025-01-01' }).expect(400);
      await editar(b.id, { orgaoId: orgaoInativoId }).expect(400);
      await editar(randomUUID(), { objeto: 'x' }).expect(404);

      expect(await prisma.contrato.findUniqueOrThrow({ where: { id: b.id } })).toMatchObject({
        numero: b.numero,
        orgaoId,
      });
      expect(await auditorias('contratos.atualizar', b.id)).toHaveLength(0);
    });

    it('segue as transições: RASCUNHO → VIGENTE → SUSPENSO → VIGENTE, e recusa as que o mapa não permite', async () => {
      const { body } = await criar(dados()).expect(201);

      await editar(body.id, { status: 'SUSPENSO' }).expect(400);
      await editar(body.id, { status: 'VIGENTE' }).expect(200);
      await editar(body.id, { status: 'RASCUNHO' }).expect(400);
      await editar(body.id, { status: 'SUSPENSO' }).expect(200);
      await editar(body.id, { status: 'VIGENTE' }).expect(200);

      expect((await prisma.contrato.findUniqueOrThrow({ where: { id: body.id } })).status).toBe('VIGENTE');
      expect(await auditorias('contratos.atualizar', body.id)).toHaveLength(3);
    });

    it('recusa ativar um contrato cuja vigência já terminou', async () => {
      const { body } = await criar(dados({ inicioVigencia: '2019-01-01', fimVigencia: '2020-01-01' })).expect(201);

      await editar(body.id, { status: 'VIGENTE' }).expect(400);

      expect((await prisma.contrato.findUniqueOrThrow({ where: { id: body.id } })).status).toBe('RASCUNHO');
    });

    it('encerra sem apagar o registro, grava a data e audita; reencerrar não mexe na data original', async () => {
      const { body } = await criar(dados()).expect(201);

      const resposta = await encerrar(body.id).expect(200);

      expect(resposta.body.status).toBe('ENCERRADO');
      const encerrado = await prisma.contrato.findUniqueOrThrow({ where: { id: body.id } });
      expect(encerrado.encerradoEm).not.toBeNull();
      expect(await auditorias('contratos.encerrar', body.id)).toHaveLength(1);

      await encerrar(body.id).expect(400);
      const depois = await prisma.contrato.findUniqueOrThrow({ where: { id: body.id } });
      expect(depois.encerradoEm?.getTime()).toBe(encerrado.encerradoEm?.getTime());
      expect(await auditorias('contratos.encerrar', body.id)).toHaveLength(1);
      await encerrar(randomUUID()).expect(404);
    });

    it('trata o contrato encerrado como histórico: nenhuma edição passa', async () => {
      const { body } = await criar(dados()).expect(201);
      await encerrar(body.id).expect(200);

      await editar(body.id, { objeto: 'tentativa' }).expect(400);
      await editar(body.id, { status: 'VIGENTE' }).expect(400);
      await editar(body.id, { fimVigencia: '2100-01-01' }).expect(400);

      expect((await prisma.contrato.findUniqueOrThrow({ where: { id: body.id } })).objeto).toBe(
        `Monitoramento ${rotulo}`,
      );
    });
  });

  describe('consulta e listagem', () => {
    const consulta = async (parametros: Record<string, string | number> = {}) => {
      const { body } = await request(app.getHttpServer())
        .get('/contratos')
        .query({ busca: rotulo, tamanho: 100, ...parametros })
        .set('Cookie', monitor.cookie)
        .expect(200);
      return body as {
        contratos: Array<{ id: string; numero: string; status: string; quantidadeEstacoes: number }>;
        total: number;
        pagina: number;
        tamanho: number;
      };
    };
    const numeros = (resposta: { contratos: Array<{ numero: string }> }) =>
      resposta.contratos.map((contrato) => contrato.numero);
    let vigente: { id: string; numero: string };
    let rascunho: { id: string; numero: string };
    let encerrado: { id: string; numero: string };
    let doOutroOrgao: { id: string; numero: string };

    beforeAll(async () => {
      rascunho = (await criar(dados({ numero: numero('-lst-rascunho') })).expect(201)).body;
      vigente = (await criar(dados({ numero: numero('-lst-vigente'), objeto: `Radar chuva ${rotulo}` })).expect(201)).body;
      await editar(vigente.id, { status: 'VIGENTE' }).expect(200);
      encerrado = (await criar(dados({ numero: numero('-lst-encerrado') })).expect(201)).body;
      await encerrar(encerrado.id).expect(200);
      doOutroOrgao = (await criar(dados({ numero: numero('-lst-outro'), orgaoId: outroOrgaoId })).expect(201)).body;
    });

    it('consulta um contrato por id e responde 404 se não existir', async () => {
      const { body } = await request(app.getHttpServer())
        .get(`/contratos/${vigente.id}`)
        .set('Cookie', monitor.cookie)
        .expect(200);

      expect(body).toMatchObject({ id: vigente.id, status: 'VIGENTE', orgao: { id: orgaoId } });
      await request(app.getHttpServer()).get(`/contratos/${randomUUID()}`).set('Cookie', monitor.cookie).expect(404);
    });

    it('filtra por status', async () => {
      expect(numeros(await consulta({ status: 'VIGENTE', busca: '-lst-' }))).toEqual([vigente.numero]);
      expect(numeros(await consulta({ status: 'ENCERRADO', busca: '-lst-' }))).toEqual([encerrado.numero]);
      expect((await consulta({ status: 'SUSPENSO', busca: '-lst-' })).total).toBe(0);
    });

    it('filtra por órgão', async () => {
      expect(numeros(await consulta({ orgaoId: outroOrgaoId, busca: '-lst-' }))).toEqual([doOutroOrgao.numero]);
      expect(numeros(await consulta({ orgaoId: outroOrgaoId }))).toContain(doOutroOrgao.numero);
      const principal = await consulta({ orgaoId, busca: '-lst-' });
      expect(numeros(principal)).not.toContain(doOutroOrgao.numero);
      expect((await consulta({ orgaoId: randomUUID() })).total).toBe(0);
    });

    it('busca por número, por objeto e pelo nome do órgão, sem diferenciar maiúsculas', async () => {
      const { body: porNumero } = await request(app.getHttpServer())
        .get('/contratos')
        .query({ busca: vigente.numero.toLowerCase() })
        .set('Cookie', monitor.cookie)
        .expect(200);
      expect(numeros(porNumero)).toEqual([vigente.numero]);

      expect(numeros(await consulta({ busca: `radar chuva ${rotulo}` }))).toEqual([vigente.numero]);

      const { body: porOrgao } = await request(app.getHttpServer())
        .get('/contratos')
        .query({ busca: `ÓRGÃO ${rotulo} OUTRO`, tamanho: 100 })
        .set('Cookie', monitor.cookie)
        .expect(200);
      expect(numeros(porOrgao)).toContain(doOutroOrgao.numero);
      expect(numeros(porOrgao)).not.toContain(rascunho.numero);
    });

    it('combina filtros', async () => {
      const resposta = await consulta({ orgaoId, status: 'RASCUNHO', busca: 'lst-rascunho' });

      expect(numeros(resposta)).toEqual([rascunho.numero]);
    });

    it('pagina com total estável e ordena do mais recente para o mais antigo', async () => {
      const completa = await consulta();
      const total = completa.total;
      expect(total).toBeGreaterThanOrEqual(4);

      const primeira = await consulta({ tamanho: 2, pagina: 1 });
      const segunda = await consulta({ tamanho: 2, pagina: 2 });
      const alem = await consulta({ tamanho: 2, pagina: 1000 });

      expect(primeira).toMatchObject({ total, pagina: 1, tamanho: 2 });
      expect(primeira.contratos).toHaveLength(2);
      expect(segunda.contratos).toHaveLength(Math.min(2, total - 2));
      expect(alem.contratos).toHaveLength(0);
      expect(alem.total).toBe(total);
      expect([...numeros(primeira), ...numeros(segunda)]).toEqual(numeros(completa).slice(0, 2 + segunda.contratos.length));
      // o último contrato criado vem primeiro
      expect(completa.contratos[0].numero).toBe(doOutroOrgao.numero);
    });

    it('recusa parâmetros inválidos com 400', async () => {
      const http = request(app.getHttpServer());
      await http.get('/contratos').query({ pagina: 0 }).set('Cookie', monitor.cookie).expect(400);
      await http.get('/contratos').query({ tamanho: 101 }).set('Cookie', monitor.cookie).expect(400);
      await http.get('/contratos').query({ tamanho: 'muitos' }).set('Cookie', monitor.cookie).expect(400);
      await http.get('/contratos').query({ status: 'ABERTO' }).set('Cookie', monitor.cookie).expect(400);
    });

    it('informa a quantidade de estações vinculadas e lista a hierarquia do contrato', async () => {
      const estacao = (sufixo: string, contratoId: string | null) =>
        prisma.estacao.create({
          data: {
            nome: `Estação ${rotulo} ${sufixo}`,
            endereco: 'Rua A',
            vid: `${rotulo}-${sufixo}`,
            usuarioId: admin.usuarioId,
            contratoId,
          },
        });
      await estacao('b', vigente.id);
      await estacao('a', vigente.id);
      await estacao('solta', null);

      const listagem = await consulta({ busca: vigente.numero });
      const { body: hierarquia } = await request(app.getHttpServer())
        .get(`/contratos/${vigente.id}/estacoes`)
        .set('Cookie', monitor.cookie)
        .expect(200);

      expect(listagem.contratos[0]).toMatchObject({ numero: vigente.numero, quantidadeEstacoes: 2 });
      expect((await consulta({ busca: rascunho.numero })).contratos[0].quantidadeEstacoes).toBe(0);
      expect((hierarquia as Array<{ nome: string }>).map((e) => e.nome)).toEqual([
        `Estação ${rotulo} a`,
        `Estação ${rotulo} b`,
      ]);
      await request(app.getHttpServer())
        .get(`/contratos/${randomUUID()}/estacoes`)
        .set('Cookie', monitor.cookie)
        .expect(404);
    });

    it('não grava auditoria extra nas consultas (o GET fica com o middleware de acesso)', async () => {
      await request(app.getHttpServer()).get(`/contratos/${vigente.id}`).set('Cookie', monitor.cookie).expect(200);
      await consulta();

      const extras = await prisma.logAuditoria.count({
        where: { acao: { in: ['contratos.consultar', 'contratos.estacoes.consultar'] } },
      });
      expect(extras).toBe(0);
    });
  });
});
