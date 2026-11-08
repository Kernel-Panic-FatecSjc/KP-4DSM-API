import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, criarSessaoDeTeste, PREFIXO_TESTE } from '../helpers';
import { afterAll, beforeAll, describe, expect, it } from '@jest/globals';

describe('Estatísticas com banco real', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string[];
  let usuarioId: string;
  let tipoParametroId: string;
  const marcador = `${PREFIXO_TESTE}estatistica-real-${Date.now()}`;
  const estacaoIds: string[] = [];

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    const licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    ({ cookie, usuarioId } = await criarSessaoDeTeste(app, 'ADMIN_TECSUS'));
    const tipo = await prisma.tipoParametro.create({
      data: { nome: marcador, unidade: '°C', fator: 1, ganho: 0, licitacaoId },
    });
    tipoParametroId = tipo.id;
    const inicio = BigInt(Math.floor(new Date('2026-01-10T12:00:00.000Z').getTime() / 1000));

    for (const [sufixo, valores] of [['A', [10, 12]], ['B', [20, 24]]] as const) {
      const estacao = await prisma.estacao.create({
        data: {
          nome: `${marcador} Estação ${sufixo}`,
          endereco: 'Teste', vid: `${marcador}-${sufixo}`,
          licitacaoId, usuarioId,
        },
      });
      estacaoIds.push(estacao.id);
      const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId: tipo.id } });
      await prisma.medida.createMany({
        data: valores.map((valor, indice) => ({
          valor, unixtime: inicio + BigInt(indice), parametroId: parametro.id, estacaoId: estacao.id, licitacaoId,
        })),
      });
    }
  }, 20_000);

  afterAll(async () => app.close());

  it('filtra pelo tipo de parâmetro e retorna leituras das duas estações', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/relatorios/estatisticas')
      .set('Cookie', cookie)
      .query({
        estacaoIds,
        parametroId: tipoParametroId,
        periodos: [
          '2026-01-10T00:00:00.000Z|2026-01-10T23:59:59.000Z',
          '2026-01-11T00:00:00.000Z|2026-01-11T23:59:59.000Z',
        ],
      })
      .expect(200);

    expect(resposta.body.periodos[0].estacoes).toHaveLength(2);
    expect(resposta.body.periodos[0].estacoes.map((e: { quantidade: number; media: number }) => [e.quantidade, e.media]))
      .toEqual([[2, 11], [2, 22]]);
  });
});

