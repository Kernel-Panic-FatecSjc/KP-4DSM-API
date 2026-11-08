import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

// Com o banco real: o alarme nasce do trigger de alertas ao gravar a medida.
describe('Dados abertos: estações e alarmes (funcional)', () => {
  let app: INestApplication;
  let estacaoId: string;
  const nomeEstacao = `${PREFIXO_TESTE}Estação pública`;

  const periodo = () => {
    const dia = (deslocamento: number) => new Date(Date.now() + deslocamento * 86_400_000).toISOString().slice(0, 10);
    return `de=${dia(-1)}&ate=${dia(1)}`;
  };

  beforeAll(async () => {
    app = await criarAppDeTeste();
    const prisma = app.get(PrismaService);
    const licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    const usuario = await prisma.usuario.create({
      data: { nome: 'Dados abertos 2', email: emailDeTeste('dados-abertos-2'), senhaHash: 'x', tipo: 'ADMIN_TECSUS' },
    });
    const estacao = await prisma.estacao.create({
      data: {
        nome: nomeEstacao,
        endereco: 'Rua Secreta, 1',
        vid: `${PREFIXO_TESTE}publica-${Date.now()}`,
        latitude: -23.18,
        longitude: -45.88,
        usuarioId: usuario.id,
        licitacaoId,
      },
    });
    estacaoId = estacao.id;
    const tipo = await prisma.tipoParametro.create({ data: { nome: 'vento', unidade: 'km/h', fator: 1, ganho: 0, licitacaoId } });
    const parametro = await prisma.parametro.create({ data: { estacaoId, tipoParametroId: tipo.id } });
    await prisma.alerta.create({ data: { parametroId: parametro.id, operador: 'MAIOR_QUE', valorLimite: 10, severidade: 'ALERTA', licitacaoId } });
    await prisma.medida.create({ data: { parametroId: parametro.id, estacaoId, licitacaoId, unixtime: BigInt(Math.floor(Date.now() / 1000)), valor: 12.5 } });
  });

  afterAll(async () => {
    await app.close();
  });

  describe('GET /v1/dados-abertos/estacoes', () => {
    it('é pública e traz só os campos do dicionário, sem dados de usuário', async () => {
      const { body } = await request(app.getHttpServer()).get('/v1/dados-abertos/estacoes?tamanhoPagina=1000').expect(200);

      const estacao = body.dados.find((e: { id: string }) => e.id === estacaoId);
      expect(estacao).toEqual({
        id: estacaoId,
        nome: nomeEstacao,
        latitude: -23.18,
        longitude: -45.88,
        statusOperacional: 'ATIVA',
        sensores: [{ nome: 'vento', unidade: 'km/h' }],
      });
      expect(JSON.stringify(body)).not.toMatch(/usuario|endereco|Rua Secreta|chaveIngestao|vid"/i);
    });

    it('o CSV traz a mesma linha, com os sensores em uma coluna', async () => {
      const resposta = await request(app.getHttpServer()).get('/v1/dados-abertos/estacoes?formato=csv&tamanhoPagina=1000').buffer(true).expect(200);

      const [cabecalho] = resposta.text.replace(/^﻿/, '').split('\r\n');
      expect(cabecalho).toBe('id;nome;latitude;longitude;statusOperacional;sensores');
      expect(resposta.text).toContain(`${estacaoId};${nomeEstacao};-23.18;-45.88;ATIVA;vento (km/h)`);
      expect(resposta.headers['content-disposition']).toContain('attachment');
    });

    it('filtra por status e rejeita status desconhecido', async () => {
      const { body } = await request(app.getHttpServer()).get('/v1/dados-abertos/estacoes?status=INATIVA&tamanhoPagina=1000').expect(200);
      expect(body.dados.some((e: { id: string }) => e.id === estacaoId)).toBe(false);

      await request(app.getHttpServer()).get('/v1/dados-abertos/estacoes?status=QUEBRADA').expect(400);
    });
  });

  describe('GET /v1/dados-abertos/alarmes', () => {
    const rota = () => `/v1/dados-abertos/alarmes?${periodo()}&estacaoId=${estacaoId}`;

    it('é pública e traz o alarme com os campos do dicionário, sem dados de usuário', async () => {
      const { body } = await request(app.getHttpServer()).get(rota()).expect(200);

      expect(body.paginacao).toEqual({ pagina: 1, tamanhoPagina: 100, total: 1 });
      expect(body.dados).toEqual([
        {
          id: expect.any(String),
          disparadoEm: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T.*Z$/),
          estacaoId,
          estacaoNome: nomeEstacao,
          parametro: 'vento',
          operador: 'MAIOR_QUE',
          valorLimite: 10,
          valorMedido: 12.5,
          severidade: 'ALERTA',
          status: 'ABERTO',
        },
      ]);
    });

    it('o CSV traz a mesma linha do JSON', async () => {
      const { body } = await request(app.getHttpServer()).get(rota()).expect(200);
      const resposta = await request(app.getHttpServer()).get(`${rota()}&formato=csv`).buffer(true).expect(200);

      const [cabecalho, ...linhas] = resposta.text.replace(/^﻿/, '').trim().split('\r\n');
      expect(cabecalho).toBe('id;disparadoEm;estacaoId;estacaoNome;parametro;operador;valorLimite;valorMedido;severidade;status');
      const a = body.dados[0];
      expect(linhas).toEqual([
        [a.id, a.disparadoEm, a.estacaoId, a.estacaoNome, a.parametro, a.operador, a.valorLimite, a.valorMedido, a.severidade, a.status].join(';'),
      ]);
    });

    it('filtra por severidade e status, devolvendo lista vazia quando nada casa', async () => {
      const outraSeveridade = await request(app.getHttpServer()).get(`${rota()}&severidade=EMERGENCIA`).expect(200);
      expect(outraSeveridade.body).toEqual({ dados: [], paginacao: { pagina: 1, tamanhoPagina: 100, total: 0 } });

      const outroStatus = await request(app.getHttpServer()).get(`${rota()}&status=RESOLVIDO`).expect(200);
      expect(outroStatus.body.dados).toEqual([]);
    });

    it('exige o período, barra mais de 366 dias e rejeita formato desconhecido', async () => {
      const http = app.getHttpServer();
      await request(http).get('/v1/dados-abertos/alarmes').expect(400);
      await request(http).get('/v1/dados-abertos/alarmes?de=2020-01-01&ate=2026-01-01').expect(400);
      await request(http).get(`${rota()}&formato=xml`).expect(400);
    });
  });
});
