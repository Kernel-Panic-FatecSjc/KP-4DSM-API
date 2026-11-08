import { INestApplication } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import {
  afterAll as jestAfterAll,
  beforeAll as jestBeforeAll,
  describe as jestDescribe,
  expect as jestExpect,
  it as jestIt,
} from '@jest/globals';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  criarAppDeTeste,
  criarLicitacaoDeTeste,
  criarSessaoDeTeste,
} from '../helpers';
import { describe } from 'node:test';

const INICIO = '2026-01-01T00:00:00.000Z';
const FIM = '2026-01-31T23:59:59.000Z';
const SEGUNDO_INICIO_PERIODO = '2026-02-01T00:00:00.000Z';
const SEGUNDO_FIM_PERIODO = '2026-02-28T23:59:59.000Z';
const SEGUNDO_INICIO = Math.floor(new Date(INICIO).getTime() / 1000);

interface ResultadoEstacao {
  estacaoId: string;
  estacaoNome: string;
  quantidade: number;
  media: number | null;
  mediana: number | null;
  desvioPadrao: number | null;
  variancia: number | null;
  quartil1: number | null;
  quartil2: number | null;
  quartil3: number | null;
  minimo: number | null;
  maximo: number | null;
}

jestDescribe('GET /relatorios/estatisticas: exatidão dos cálculos (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string[];
  let parametroId: string;
  let estacoes: Record<string, string>;
  let parametrosDasEstacoes: Record<string, string>;

  jestBeforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);
    const licitacao = await criarLicitacaoDeTeste(app);
    const sessao = await criarSessaoDeTeste(app, 'ADMIN_TECSUS');
    cookie = sessao.cookie;
    const usuarioId = sessao.usuarioId;

    const tipo = await prisma.tipoParametro.create({
      data: {
        nome: `Métrica ${randomUUID()}`,
        unidade: 'u',
        fator: 1,
        ganho: 1,
        licitacaoId: licitacao.id,
      },
    });
    parametroId = tipo.id;

    estacoes = {};
    parametrosDasEstacoes = {};
    for (const nome of ['unica', 'repetidos', 'par', 'impar', 'sem-dados']) {
      const estacao = await prisma.estacao.create({
        data: {
          nome,
          endereco: 'Endereço de teste',
          vid: `teste-${randomUUID()}`,
          usuarioId,
          licitacaoId: licitacao.id,
          parametros: nome === 'sem-dados'
            ? undefined
            : { create: { tipoParametroId: tipo.id } },
        },
        include: { parametros: true },
      });
      estacoes[nome] = estacao.id;
      if (estacao.parametros[0]) parametrosDasEstacoes[nome] = estacao.parametros[0].id;
    }

    const amostras: Record<string, number[]> = {
      unica: [7],
      repetidos: [4, 4, 4],
      par: [1, 2, 3, 4],
      impar: [1, 2, 3, 4, 10],
    };
    for (const [nome, valores] of Object.entries(amostras)) {
      await prisma.medida.createMany({
        data: valores.map((valor, indice) => ({
          estacaoId: estacoes[nome],
          parametroId: parametrosDasEstacoes[nome],
          licitacaoId: licitacao.id,
          valor,
          unixtime: BigInt(SEGUNDO_INICIO + indice),
        })),
      });
    }
  });

  jestAfterAll(async () => app.close());

  jestIt('confere média, mediana, quartis e estatísticas populacionais contra valores de referência', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/relatorios/estatisticas')
      .set('Cookie', cookie)
      .query({
        estacaoIds: Object.values(estacoes),
        parametroId,
        periodos: [
          `${INICIO}|${FIM}`,
          `${SEGUNDO_INICIO_PERIODO}|${SEGUNDO_FIM_PERIODO}`,
        ],
      })
      .expect(200);

    const porNome = new Map<string, ResultadoEstacao>(
      resposta.body.periodos[0].estacoes.map((estacao: ResultadoEstacao) => [
        estacoes[estacao.estacaoNome], estacao,
      ] as [string, ResultadoEstacao]),
    );

    // Referências independentes: quantis contínuos por interpolação linear;
    // variância e desvio padrão populacionais (divisor N).
    jestExpect(porNome.get(estacoes.unica)).toMatchObject({
      quantidade: 1, media: 7, mediana: 7, quartil1: 7, quartil2: 7, quartil3: 7,
      variancia: 0, desvioPadrao: 0, minimo: 7, maximo: 7,
    });
    jestExpect(porNome.get(estacoes.repetidos)).toMatchObject({
      quantidade: 3, media: 4, mediana: 4, quartil1: 4, quartil2: 4, quartil3: 4,
      variancia: 0, desvioPadrao: 0, minimo: 4, maximo: 4,
    });
    jestExpect(porNome.get(estacoes.par)).toMatchObject({
      quantidade: 4, media: 2.5, mediana: 2.5, quartil1: 1.75, quartil2: 2.5,
      quartil3: 3.25, variancia: 1.25, minimo: 1, maximo: 4,
    });
    jestExpect(porNome.get(estacoes.par)?.desvioPadrao).toBeCloseTo(Math.sqrt(1.25), 12);
    jestExpect(porNome.get(estacoes.impar)).toMatchObject({
      quantidade: 5, media: 4, mediana: 3, quartil1: 2, quartil2: 3, quartil3: 4,
      minimo: 1, maximo: 10,
    });
    jestExpect(porNome.get(estacoes.impar)?.variancia).toBeCloseTo(10, 12);
    jestExpect(porNome.get(estacoes.impar)?.desvioPadrao).toBeCloseTo(Math.sqrt(10), 12);
    jestExpect(porNome.get(estacoes['sem-dados'])).toMatchObject({
      quantidade: 0, media: null, mediana: null, quartil1: null, quartil2: null,
      quartil3: null, variancia: null, desvioPadrao: null, minimo: null, maximo: null,
    });
  });
});
