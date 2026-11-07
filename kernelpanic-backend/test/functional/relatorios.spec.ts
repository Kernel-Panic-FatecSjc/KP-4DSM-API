import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import {
  criarAppDeTeste,
  criarLicitacaoDeTeste,
  criarSessaoDeTeste,
} from '../helpers';

describe('Relatórios de histórico climático (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string[];
  let estacaoId: string;

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);

    const licitacao = await criarLicitacaoDeTeste(app);
    const sessao = await criarSessaoDeTeste(
      app,
      'ADMIN_LICITACAO',
      licitacao.id,
    );
    cookie = sessao.cookie;

    const estacao = await prisma.estacao.create({
      data: {
        nome: 'Estação de teste relatório anual',
        endereco: 'Centro, São José dos Campos - SP',
        vid: `teste-relatorio-${Date.now()}`,
        usuarioId: sessao.usuarioId,
        licitacaoId: licitacao.id,
      },
    });
    estacaoId = estacao.id;

    const [chuva, temperatura] = await Promise.all([
      prisma.tipoParametro.create({
        data: {
          nome: 'Chuva teste relatório',
          unidade: 'mm',
          fator: 1,
          ganho: 0,
          agregacao: 'SOMA',
          licitacaoId: licitacao.id,
        },
      }),
      prisma.tipoParametro.create({
        data: {
          nome: 'Temperatura teste relatório',
          unidade: '°C',
          fator: 1,
          ganho: 0,
          agregacao: 'MEDIA',
          licitacaoId: licitacao.id,
        },
      }),
    ]);

    const [parametroChuva, parametroTemperatura] = await Promise.all([
      prisma.parametro.create({
        data: { estacaoId, tipoParametroId: chuva.id },
      }),
      prisma.parametro.create({
        data: { estacaoId, tipoParametroId: temperatura.id },
      }),
    ]);

    const medidas: {
      valor: number;
      unixtime: bigint;
      parametroId: string;
      estacaoId: string;
      licitacaoId: string;
    }[] = [];
    const inicio = Date.UTC(2025, 0, 1) / 1000;
    for (let dia = 0; dia < 365; dia++) {
      for (let leitura = 0; leitura < 4; leitura++) {
        const unixtime = BigInt(
          inicio + dia * 24 * 60 * 60 + leitura * 60 * 60,
        );
        medidas.push({
          valor: leitura + 1,
          unixtime,
          parametroId: parametroChuva.id,
          estacaoId,
          licitacaoId: licitacao.id,
        });
        medidas.push({
          valor: 20 + leitura,
          unixtime,
          parametroId: parametroTemperatura.id,
          estacaoId,
          licitacaoId: licitacao.id,
        });
      }
    }

    await prisma.medida.createMany({ data: medidas });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('consolida um ano no banco, respeitando SOMA/MEDIA e retorna os totais por período', async () => {
    const inicio = performance.now();
    const resposta = await request(app.getHttpServer())
      .get('/relatorios/historico-climatico')
      .query({
        de: '2025-01-01',
        ate: '2025-12-31',
        granularidade: 'dia',
        estacaoIds: estacaoId,
      })
      .set('Cookie', cookie)
      .expect(200);
    const duracaoMs = performance.now() - inicio;

    const estacao = resposta.body.estacoes.find(
      (item: { id: string }) => item.id === estacaoId,
    );
    const parametroChuva = estacao.parametros.find(
      (item: { unidade: string }) => item.unidade === 'mm',
    );
    const parametroTemperatura = estacao.parametros.find(
      (item: { unidade: string }) => item.unidade === '°C',
    );

    expect(parametroChuva.agregacao).toBe('SOMA');
    expect(parametroChuva.periodos).toHaveLength(365);
    expect(parametroChuva.periodos[0]).toMatchObject({
      valor: 10,
      soma: 10,
      leituras: 4,
    });
    expect(parametroChuva.totalPeriodo).toMatchObject({
      valor: 3650,
      soma: 3650,
      leituras: 1460,
    });
    expect(parametroTemperatura.agregacao).toBe('MEDIA');
    expect(parametroTemperatura.periodos).toHaveLength(365);
    expect(parametroTemperatura.periodos[0]).toMatchObject({
      valor: 21.5,
      media: 21.5,
      leituras: 4,
    });
    expect(parametroTemperatura.totalPeriodo).toMatchObject({
      valor: 21.5,
      media: 21.5,
      leituras: 1460,
    });
    expect(resposta.body.estacoes).toHaveLength(1);

    console.info(
      `GET /relatorios/historico-climatico: período de 1 ano concluído em ${duracaoMs.toFixed(1)} ms`,
    );

    const auditoria = await prisma.logAuditoria.findFirst({
      where: {
        acao: 'relatorios.historico-climatico',
        entidadeId: null,
        usuarioId: { not: null },
      },
      orderBy: { criadoEm: 'desc' },
    });
    expect(auditoria).toBeTruthy();
  }, 30_000);
});
