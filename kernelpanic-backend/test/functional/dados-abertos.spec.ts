import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

// Com o banco real: a agregação roda no PostgreSQL e a rota é pública. Os dados
// ficam em 2031 para não se misturar com o que as outras suítes gravam.
describe('Dados abertos: medidas (funcional)', () => {
  let app: INestApplication;
  let estacaoId: string;

  const unix = (iso: string) => BigInt(Math.floor(new Date(iso).getTime() / 1000));
  const consulta = '/v1/dados-abertos/medidas?de=2031-03-01&ate=2031-03-01&granularidade=hora';

  beforeAll(async () => {
    app = await criarAppDeTeste();
    const prisma = app.get(PrismaService);
    const licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    const usuario = await prisma.usuario.create({
      data: { nome: 'Dados abertos', email: emailDeTeste('dados-abertos'), senhaHash: 'x', tipo: 'ADMIN_TECSUS' },
    });
    const estacao = await prisma.estacao.create({
      data: { nome: `${PREFIXO_TESTE}Estação aberta`, endereco: 'Rua', vid: `${PREFIXO_TESTE}aberta-${Date.now()}`, usuarioId: usuario.id, licitacaoId },
    });
    estacaoId = estacao.id;

    const sensor = async (nome: string, unidade: string, agregacao: 'SOMA' | 'MEDIA') => {
      const tipo = await prisma.tipoParametro.create({ data: { nome, unidade, fator: 1, ganho: 0, agregacao, licitacaoId } });
      return prisma.parametro.create({ data: { estacaoId, tipoParametroId: tipo.id } });
    };
    const chuva = await sensor('chuva', 'mm', 'SOMA');
    const temperatura = await sensor('temperatura', '°C', 'MEDIA');

    const medidas: [string, string, number][] = [
      [chuva.id, '2031-03-01T10:10:00Z', 1],
      [chuva.id, '2031-03-01T10:50:00Z', 2],
      [chuva.id, '2031-03-01T11:05:00Z', 4],
      [temperatura.id, '2031-03-01T10:20:00Z', 20],
      [temperatura.id, '2031-03-01T10:40:00Z', 30],
    ];
    await prisma.medida.createMany({
      data: medidas.map(([parametroId, iso, valor]) => ({ parametroId, estacaoId, licitacaoId, unixtime: unix(iso), valor })),
    });
  });

  afterAll(async () => {
    await app.close();
  });

  it('é pública e agrega por hora no banco (SOMA para chuva, MEDIA para temperatura)', async () => {
    const { body } = await request(app.getHttpServer()).get(`${consulta}&estacaoId=${estacaoId}`).expect(200);

    expect(body.paginacao).toEqual({ pagina: 1, tamanhoPagina: 100, total: 3 });
    expect(body.dados).toEqual([
      expect.objectContaining({ parametro: 'chuva', inicio: '2031-03-01T10:00:00.000Z', agregacao: 'SOMA', valor: 3, quantidadeLeituras: 2, unidade: 'mm' }),
      expect.objectContaining({ parametro: 'temperatura', inicio: '2031-03-01T10:00:00.000Z', agregacao: 'MEDIA', valor: 25, quantidadeLeituras: 2 }),
      expect.objectContaining({ parametro: 'chuva', inicio: '2031-03-01T11:00:00.000Z', valor: 4, quantidadeLeituras: 1 }),
    ]);
  });

  it('a mesma consulta em CSV traz as mesmas linhas, com cabeçalho e download', async () => {
    const url = `${consulta}&estacaoId=${estacaoId}`;
    const { body } = await request(app.getHttpServer()).get(url).expect(200);
    const resposta = await request(app.getHttpServer()).get(`${url}&formato=csv`).buffer(true).expect(200);

    expect(resposta.headers['content-type']).toContain('text/csv');
    expect(resposta.headers['content-disposition']).toContain('attachment');
    const [cabecalho, ...linhas] = resposta.text.replace(/^﻿/, '').trim().split('\r\n');
    expect(cabecalho).toBe('estacaoId;estacaoNome;parametro;unidade;inicio;granularidade;agregacao;valor;quantidadeLeituras');
    expect(linhas).toEqual(
      body.dados.map((d: Record<string, unknown>) =>
        [d.estacaoId, d.estacaoNome, d.parametro, d.unidade, d.inicio, d.granularidade, d.agregacao, d.valor, d.quantidadeLeituras].join(';'),
      ),
    );
  });

  it('o header Accept: text/csv escolhe o CSV quando não há ?formato', async () => {
    const resposta = await request(app.getHttpServer()).get(`${consulta}&estacaoId=${estacaoId}`).set('Accept', 'text/csv').buffer(true).expect(200);

    expect(resposta.headers['content-type']).toContain('text/csv');
  });

  it('filtra por parâmetro e pagina', async () => {
    const porParametro = await request(app.getHttpServer()).get(`${consulta}&estacaoId=${estacaoId}&parametro=TEMPERATURA`).expect(200);
    expect(porParametro.body.dados).toHaveLength(1);

    const pagina2 = await request(app.getHttpServer()).get(`${consulta}&estacaoId=${estacaoId}&tamanhoPagina=2&pagina=2`).expect(200);
    expect(pagina2.body.dados).toHaveLength(1);
    expect(pagina2.body.paginacao).toEqual({ pagina: 2, tamanhoPagina: 2, total: 3 });
  });

  it('período sem medidas devolve lista vazia, sem inventar dados', async () => {
    const { body } = await request(app.getHttpServer())
      .get(`/v1/dados-abertos/medidas?de=2031-04-01&ate=2031-04-02&granularidade=hora&estacaoId=${estacaoId}`)
      .expect(200);

    expect(body).toEqual({ dados: [], paginacao: { pagina: 1, tamanhoPagina: 100, total: 0 } });
  });

  it('rejeita período ausente, acima do limite, formato desconhecido e página fora do teto', async () => {
    const http = app.getHttpServer();
    await request(http).get('/v1/dados-abertos/medidas').expect(400);
    await request(http).get('/v1/dados-abertos/medidas?de=2031-01-01&ate=2031-03-01&granularidade=hora').expect(400);
    await request(http).get(`${consulta}&formato=xml`).expect(400);
    await request(http).get(`${consulta}&tamanhoPagina=1001`).expect(400);
  });
});
