import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarSessaoDeTeste, gerarCnpj } from '../helpers';

// Com o banco real: unicidade de CNPJ, normalização, filtros da listagem e
// auditoria gravada. Os dados levam um rótulo único da execução, então as
// suítes funcionais podem rodar em paralelo sem se atrapalhar.
describe('Órgãos com banco real (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let admin: Awaited<ReturnType<typeof criarSessaoDeTeste>>;
  let monitor: Awaited<ReturnType<typeof criarSessaoDeTeste>>;

  const rotulo = randomUUID().slice(0, 8);
  const novo = (sufixo: string, extra: Record<string, unknown> = {}) => ({
    nome: `Prefeitura ${rotulo} ${sufixo}`,
    cnpj: gerarCnpj(),
    esfera: 'MUNICIPAL',
    municipio: `Cidade ${rotulo} ${sufixo}`,
    uf: 'sp',
    ...extra,
  });
  const criar = (corpo: Record<string, unknown>) =>
    request(app.getHttpServer()).post('/orgaos').set('Cookie', admin.cookie).send(corpo);
  const auditorias = (acao: string, entidadeId: string) =>
    prisma.logAuditoria.findMany({ where: { acao, entidadeId } });

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    admin = await criarSessaoDeTeste(app, 'ADMINISTRADOR');
    monitor = await criarSessaoDeTeste(app, 'MONITOR');
  }, 15_000);

  afterAll(async () => {
    await app.close();
  });

  describe('permissões', () => {
    it('devolve 401 sem login em todas as rotas', async () => {
      const http = request(app.getHttpServer());
      await http.get('/orgaos').expect(401);
      await http.get(`/orgaos/${randomUUID()}`).expect(401);
      await http.post('/orgaos').send(novo('sem-login')).expect(401);
      await http.patch(`/orgaos/${randomUUID()}`).send({ nome: 'x' }).expect(401);
      await http.delete(`/orgaos/${randomUUID()}`).expect(401);
    });

    it('devolve 403 ao MONITOR nas rotas de escrita, sem gravar nem auditar, e deixa ele consultar', async () => {
      const { body: existente } = await criar(novo('permissoes')).expect(201);
      const dados = novo('monitor');
      const http = request(app.getHttpServer());

      await http.post('/orgaos').set('Cookie', monitor.cookie).send(dados).expect(403);
      await http
        .patch(`/orgaos/${existente.id}`)
        .set('Cookie', monitor.cookie)
        .send({ nome: 'Alterado pelo monitor' })
        .expect(403);
      await http.delete(`/orgaos/${existente.id}`).set('Cookie', monitor.cookie).expect(403);

      expect(await prisma.orgaoPublico.count({ where: { cnpj: dados.cnpj } })).toBe(0);
      const intacto = await prisma.orgaoPublico.findUniqueOrThrow({ where: { id: existente.id } });
      expect(intacto).toMatchObject({ nome: `Prefeitura ${rotulo} permissoes`, ativo: true });
      expect(await auditorias('orgaos.atualizar', existente.id)).toHaveLength(0);
      expect(await auditorias('orgaos.inativar', existente.id)).toHaveLength(0);

      await http.get('/orgaos').set('Cookie', monitor.cookie).expect(200);
      await http.get(`/orgaos/${existente.id}`).set('Cookie', monitor.cookie).expect(200);
    });
  });

  describe('cadastro', () => {
    it('grava normalizando CNPJ (só dígitos) e UF, e registra a auditoria', async () => {
      const dados = novo('cadastro');
      const mascara = dados.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

      const { body } = await criar({ ...dados, cnpj: mascara }).expect(201);

      expect(body).toMatchObject({ cnpj: dados.cnpj, uf: 'SP', ativo: true, esfera: 'MUNICIPAL' });
      const gravado = await prisma.orgaoPublico.findUniqueOrThrow({ where: { id: body.id } });
      expect(gravado).toMatchObject({ cnpj: dados.cnpj, uf: 'SP' });
      const [registro] = await auditorias('orgaos.criar', body.id);
      expect(registro).toMatchObject({ entidade: 'OrgaoPublico', usuarioId: admin.usuarioId });
    });

    it('aceita órgão sem CNPJ', async () => {
      const { body } = await criar(novo('sem-cnpj', { cnpj: undefined })).expect(201);

      expect(body.cnpj).toBeNull();
    });

    it('recusa CNPJ já cadastrado com 409, inclusive escrito com máscara, sem duplicar nem auditar', async () => {
      const dados = novo('duplicado');
      await criar(dados).expect(201);
      const mascara = dados.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

      await criar({ ...dados, nome: 'Outro nome' }).expect(409);
      await criar({ ...dados, cnpj: mascara }).expect(409);

      expect(await prisma.orgaoPublico.count({ where: { cnpj: dados.cnpj } })).toBe(1);
      const criados = await prisma.logAuditoria.count({
        where: { acao: 'orgaos.criar', entidadeId: { not: null }, detalhes: { path: ['nome'], equals: 'Outro nome' } },
      });
      expect(criados).toBe(0);
    });

    it('com cadastros simultâneos do mesmo CNPJ, só um entra e os demais recebem 409 (nunca 500)', async () => {
      const dados = novo('corrida');

      const respostas = await Promise.all(Array.from({ length: 8 }, () => criar(dados)));

      const status = respostas.map((resposta) => resposta.status).sort();
      expect(status.filter((codigo) => codigo === 201)).toHaveLength(1);
      expect(status.filter((codigo) => codigo === 409)).toHaveLength(7);
      expect(await prisma.orgaoPublico.count({ where: { cnpj: dados.cnpj } })).toBe(1);
    });

    it.each([
      ['CNPJ com dígito verificador errado', { cnpj: '11222333000182' }],
      ['CNPJ curto', { cnpj: '123' }],
      ['CNPJ com letras', { cnpj: 'abcdefghijklmn' }],
      ['CNPJ de dígitos repetidos', { cnpj: '11111111111111' }],
      ['esfera inexistente', { esfera: 'GALACTICA' }],
      ['UF com 3 letras', { uf: 'SPP' }],
      ['UF numérica', { uf: '12' }],
      ['nome vazio', { nome: '' }],
      ['município vazio', { municipio: '' }],
    ])('recusa com 400 %s, sem gravar', async (_descricao, alteracao) => {
      const dados = novo('invalido', alteracao);

      await criar(dados).expect(400);

      expect(await prisma.orgaoPublico.count({ where: { nome: dados.nome } })).toBe(0);
    });
  });

  describe('edição e inativação', () => {
    it('edita, mantém o resto, recusa CNPJ de outro órgão e audita só o que passou', async () => {
      const { body: a } = await criar(novo('edita-a')).expect(201);
      const { body: b } = await criar(novo('edita-b')).expect(201);
      const http = request(app.getHttpServer());

      const editado = await http
        .patch(`/orgaos/${a.id}`)
        .set('Cookie', admin.cookie)
        .send({ municipio: 'Outra cidade', uf: 'rj' })
        .expect(200);
      expect(editado.body).toMatchObject({ municipio: 'Outra cidade', uf: 'RJ', nome: a.nome, cnpj: a.cnpj });

      await http.patch(`/orgaos/${a.id}`).set('Cookie', admin.cookie).send({ cnpj: b.cnpj }).expect(409);
      await http.patch(`/orgaos/${a.id}`).set('Cookie', admin.cookie).send({ cnpj: '123' }).expect(400);
      await http.patch(`/orgaos/${randomUUID()}`).set('Cookie', admin.cookie).send({ nome: 'x' }).expect(404);

      const doBanco = await prisma.orgaoPublico.findUniqueOrThrow({ where: { id: a.id } });
      expect(doBanco).toMatchObject({ municipio: 'Outra cidade', uf: 'RJ', cnpj: a.cnpj });
      const registros = await auditorias('orgaos.atualizar', a.id);
      expect(registros).toHaveLength(1);
      expect(registros[0].detalhes).toMatchObject({ campos: ['municipio', 'uf'] });
    });

    it('inativa logicamente: o órgão continua no banco, inativo, com auditoria', async () => {
      const { body } = await criar(novo('inativa')).expect(201);

      const resposta = await request(app.getHttpServer())
        .delete(`/orgaos/${body.id}`)
        .set('Cookie', admin.cookie)
        .expect(200);

      expect(resposta.body.ativo).toBe(false);
      expect(await prisma.orgaoPublico.findUnique({ where: { id: body.id } })).toMatchObject({ ativo: false });
      expect(await auditorias('orgaos.inativar', body.id)).toHaveLength(1);
      await request(app.getHttpServer())
        .delete(`/orgaos/${randomUUID()}`)
        .set('Cookie', admin.cookie)
        .expect(404);
    });
  });

  describe('filtros da listagem', () => {
    let alfa: { id: string; cnpj: string };
    let beta: { id: string; cnpj: string };
    let gama: { id: string; cnpj: string };
    const filtrar = async (consulta: Record<string, string>) => {
      const { body } = await request(app.getHttpServer())
        .get('/orgaos')
        .query({ busca: `${rotulo} filtro`, ...consulta })
        .set('Cookie', monitor.cookie)
        .expect(200);
      return (body as Array<{ id: string }>).map((orgao) => orgao.id);
    };

    beforeAll(async () => {
      alfa = (await criar(novo('filtro-alfa', { esfera: 'MUNICIPAL', municipio: `Taubaté ${rotulo}` })).expect(201)).body;
      beta = (await criar(novo('filtro-beta', { esfera: 'ESTADUAL' })).expect(201)).body;
      gama = (await criar(novo('filtro-gama', { esfera: 'MUNICIPAL' })).expect(201)).body;
      await request(app.getHttpServer()).delete(`/orgaos/${gama.id}`).set('Cookie', admin.cookie).expect(200);
    });

    it('busca por nome sem diferenciar maiúsculas e devolve em ordem alfabética', async () => {
      const { body } = await request(app.getHttpServer())
        .get('/orgaos')
        .query({ busca: `PREFEITURA ${rotulo}` })
        .set('Cookie', monitor.cookie)
        .expect(200);

      const nomes = (body as Array<{ id: string; nome: string }>)
        .filter((orgao) => [alfa.id, beta.id, gama.id].includes(orgao.id))
        .map((orgao) => orgao.nome);
      expect(nomes).toEqual([...nomes].sort((x, y) => x.localeCompare(y)));
      expect(nomes).toHaveLength(3);
    });

    it('busca por município', async () => {
      expect(await filtrar({ busca: `taubaté ${rotulo}` })).toEqual([alfa.id]);
    });

    it('busca por CNPJ, com ou sem máscara', async () => {
      const mascara = beta.cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');

      expect(await filtrar({ busca: beta.cnpj })).toEqual([beta.id]);
      expect(await filtrar({ busca: mascara })).toEqual([beta.id]);
    });

    it('filtra por esfera', async () => {
      const ids = await filtrar({ esfera: 'ESTADUAL' });

      expect(ids).toEqual([beta.id]);
    });

    it('filtra por ativo e inativo', async () => {
      expect(await filtrar({ ativo: 'false' })).toEqual([gama.id]);
      const ativos = await filtrar({ ativo: 'true' });
      expect(ativos).toEqual(expect.arrayContaining([alfa.id, beta.id]));
      expect(ativos).not.toContain(gama.id);
    });

    it('combina filtros', async () => {
      expect(await filtrar({ esfera: 'MUNICIPAL', ativo: 'true' })).toEqual([alfa.id]);
    });

    it('recusa filtro inválido com 400', async () => {
      await request(app.getHttpServer()).get('/orgaos').query({ esfera: 'XYZ' }).set('Cookie', monitor.cookie).expect(400);
      await request(app.getHttpServer()).get('/orgaos').query({ ativo: 'talvez' }).set('Cookie', monitor.cookie).expect(400);
    });
  });
});
