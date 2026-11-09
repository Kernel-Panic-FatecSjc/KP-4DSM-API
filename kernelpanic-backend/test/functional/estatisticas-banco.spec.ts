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
  let licitacaoId: string;
  const marcador = `${PREFIXO_TESTE}estatistica-real-${Date.now()}`;
  const estacaoIds: string[] = [];

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    licitacaoId = (await criarLicitacaoDeTeste(app)).id;
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

  it('confere os cálculos com referências nos casos de borda', async () => {
    const inicio = BigInt(Math.floor(new Date('2026-01-12T12:00:00.000Z').getTime() / 1000));
    const cenarios = [
      { nome: 'Única', valores: [7], esperado: { quantidade: 1, media: 7, mediana: 7, quartil1: 7, quartil2: 7, quartil3: 7, variancia: 0, desvioPadrao: 0 } },
      { nome: 'Repetidos', valores: [5, 5, 5, 5], esperado: { quantidade: 4, media: 5, mediana: 5, quartil1: 5, quartil2: 5, quartil3: 5, variancia: 0, desvioPadrao: 0 } },
      // Referências equivalentes a QUARTILE.INC, com interpolação linear.
      { nome: 'Ímpar', valores: [1, 3, 5, 7, 9], esperado: { quantidade: 5, media: 5, mediana: 5, quartil1: 3, quartil2: 5, quartil3: 7, variancia: 8, desvioPadrao: Math.sqrt(8) } },
      { nome: 'Par', valores: [1, 2, 3, 4], esperado: { quantidade: 4, media: 2.5, mediana: 2.5, quartil1: 1.75, quartil2: 2.5, quartil3: 3.25, variancia: 1.25, desvioPadrao: Math.sqrt(1.25) } },
      { nome: 'Sem dados', valores: [], esperado: { quantidade: 0, media: null, mediana: null, quartil1: null, quartil2: null, quartil3: null, variancia: null, desvioPadrao: null } },
    ] as const;
    const ids: string[] = [];

    for (const [indice, cenario] of cenarios.entries()) {
      const estacao = await prisma.estacao.create({
        data: {
          nome: `${marcador} ${cenario.nome}`, endereco: 'Teste', vid: `${marcador}-borda-${indice}`,
          licitacaoId, usuarioId,
        },
      });
      ids.push(estacao.id);
      const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId } });
      if (cenario.valores.length) {
        await prisma.medida.createMany({
          data: cenario.valores.map((valor, leitura) => ({
            valor, unixtime: inicio + BigInt(leitura), parametroId: parametro.id, estacaoId: estacao.id, licitacaoId,
          })),
        });
      }
    }

    const resposta = await request(app.getHttpServer())
      .get('/relatorios/estatisticas')
      .set('Cookie', cookie)
      .query({
        estacaoIds: ids,
        parametroId: tipoParametroId,
        periodos: [
          '2026-01-12T00:00:00.000Z|2026-01-12T23:59:59.000Z',
          '2026-01-13T00:00:00.000Z|2026-01-13T23:59:59.000Z',
        ],
      })
      .expect(200);

    const porNome = new Map<string, { estacaoNome: string; [metrica: string]: string | number | null }>(
      resposta.body.periodos[0].estacoes.map((estacao: { estacaoNome: string; [metrica: string]: string | number | null }) => [estacao.estacaoNome, estacao]),
    );
    for (const cenario of cenarios) {
      const resultado = porNome.get(`${marcador} ${cenario.nome}`);
      expect(resultado).toBeDefined();
      expect(resultado).toMatchObject(cenario.esperado);
      if (cenario.valores.length) {
        expect(resultado!.media).toBeCloseTo(cenario.esperado.media!, 12);
        expect(resultado!.variancia).toBeCloseTo(cenario.esperado.variancia!, 12);
        expect(resultado!.desvioPadrao).toBeCloseTo(cenario.esperado.desvioPadrao!, 12);
        expect(resultado!.minimo).toBe(Math.min(...cenario.valores));
        expect(resultado!.maximo).toBe(Math.max(...cenario.valores));
      }
    }
  });
});

