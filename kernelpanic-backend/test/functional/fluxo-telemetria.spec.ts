import { INestApplication } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import request from 'supertest';
import { HEADER_CHAVE_INGESTAO } from '../../servicos/ingestao/http/guarda-chave-ingestao.guard';
import { IngestaoAppModule } from '../../servicos/ingestao/ingestao.module';
import { IngestaoService } from '../../servicos/ingestao/ingestao.service';
import { TratamentoService } from '../../servicos/tratamento/tratamento.service';
import { calcularHashChaveIngestao } from '../../src/estacoes/chave-ingestao';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, emailDeTeste, PREFIXO_TESTE } from '../helpers';

// Cadeia completa com o banco real (US16, SCRUM-142): a estação envia pela
// rota HTTP da ingestão, a ingestão grava leituras_brutas e o tratamento gera
// medidas, alarmes e leituras com erro. Cobre RF05.13 (faixa física) e RF05.14
// (estação inativa) de ponta a ponta, com nomes de sensor como os do cadastro.

const CHAVE = 'chave-fluxo-telemetria';
const UNIXTIME = 1_760_000_000;

describe('Fluxo completo de telemetria: ingestão → tratamento (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let ingestao: IngestaoService;
  let tratamento: TratamentoService;
  let licitacaoId: string;
  let usuarioId: string;
  let sequencia = 0;

  const criarEstacao = async (statusOperacional: 'ATIVA' | 'INATIVA') => {
    const vid = `${PREFIXO_TESTE}fluxo-${statusOperacional.toLowerCase()}-${Date.now()}-${++sequencia}`;
    const estacao = await prisma.estacao.create({
      data: {
        nome: `${PREFIXO_TESTE}Fluxo ${statusOperacional}`,
        endereco: 'Rua do fluxo',
        vid,
        statusOperacional,
        chaveIngestaoHash: calcularHashChaveIngestao(CHAVE),
        usuarioId,
        licitacaoId,
      },
    });
    for (const tipo of await prisma.tipoParametro.findMany({ where: { licitacaoId } })) {
      const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId: tipo.id } });
      if (tipo.nome === 'Pluviômetro') {
        await prisma.alerta.create({
          data: { parametroId: parametro.id, operador: 'MAIOR_QUE', valorLimite: 10, severidade: 'ALERTA', licitacaoId },
        });
      }
    }
    return { vid, estacaoId: estacao.id };
  };

  const enviar = (vid: string, leituras: Record<string, number>, unixtime = UNIXTIME) =>
    request(app.getHttpServer())
      .post('/ingestao/telemetria')
      .set(HEADER_CHAVE_INGESTAO, CHAVE)
      .send({ vid, unixtime, leituras });

  /** Grava o lote da ingestão e trata até não sobrar nada pendente. */
  const processar = async () => {
    await ingestao.flush();
    while ((await tratamento.processarLote()).leituras > 0);
  };

  const situacao = async (vid: string, estacaoId: string) => {
    const [linha] = await prisma.$queryRaw<{ brutas: bigint; medidas: bigint; alarmes: bigint; erros: bigint }[]>`
      SELECT
        (SELECT count(*) FROM leituras_brutas WHERE "vidEstacao" = ${vid}) AS brutas,
        (SELECT count(*) FROM medidas WHERE "estacaoId" = ${estacaoId}) AS medidas,
        (SELECT count(*) FROM alarmes a JOIN medidas m ON m.id = a."medidaId" WHERE m."estacaoId" = ${estacaoId}) AS alarmes,
        (SELECT count(*) FROM leituras_erro WHERE "vidEstacao" = ${vid}) AS erros`;
    return {
      brutas: Number(linha.brutas),
      medidas: Number(linha.medidas),
      alarmes: Number(linha.alarmes),
      erros: Number(linha.erros),
    };
  };

  beforeAll(async () => {
    app = await criarAppDeTeste({ modulo: IngestaoAppModule });
    prisma = app.get(PrismaService);
    ingestao = app.get(IngestaoService);
    // Sem timer nem LISTEN: o teste decide quando tratar.
    tratamento = new TratamentoService(prisma, { get: () => undefined } as unknown as ConfigService);

    licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    usuarioId = (
      await prisma.usuario.create({
        data: { nome: 'Fluxo telemetria', email: emailDeTeste('fluxo'), senhaHash: 'x', tipo: 'ADMIN_TECSUS' },
      })
    ).id;
    // Nomes como o cadastro aceita: com acento e espaço (SCRUM-140).
    await prisma.tipoParametro.createMany({
      data: [
        { nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0, valorMinimo: 0, valorMaximo: 500, licitacaoId },
        { nome: 'Temperatura do ar', unidade: '°C', fator: 1, ganho: 0, valorMinimo: -40, valorMaximo: 60, licitacaoId },
      ],
    });
    await processar();
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('estação ativa: as leituras válidas viram medida e a que viola o alerta dispara alarme', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA');

    const resposta = await enviar(vid, { Pluviômetro: 25, 'Temperatura do ar': 22.5 }).expect(202);
    expect(resposta.body).toMatchObject({ estacaoInativa: false });
    await processar();

    expect(await situacao(vid, estacaoId)).toEqual({ brutas: 1, medidas: 2, alarmes: 1, erros: 0 });
    const medidas = await prisma.medida.findMany({ where: { estacaoId }, select: { valor: true, unixtime: true, licitacaoId: true } });
    expect(medidas).toEqual(
      expect.arrayContaining([
        { valor: 25, unixtime: BigInt(UNIXTIME), licitacaoId },
        { valor: 22.5, unixtime: BigInt(UNIXTIME), licitacaoId },
      ]),
    );
  });

  it('RF05.13: a leitura fora da faixa física vira erro, sem medida nem alarme, e as outras do pacote seguem', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA');

    await enviar(vid, { Pluviômetro: 900, 'Temperatura do ar': -55 }, UNIXTIME + 300).expect(202);
    await enviar(vid, { Pluviômetro: 3, 'Temperatura do ar': 18 }, UNIXTIME + 600).expect(202);
    await processar();

    expect(await situacao(vid, estacaoId)).toEqual({ brutas: 2, medidas: 2, alarmes: 0, erros: 2 });
    const erros = await prisma.leituraErro.findMany({
      where: { vidEstacao: vid },
      select: { nomeSensor: true, valor: true, motivo: true, valorMinimo: true, valorMaximo: true, licitacaoId: true },
      orderBy: { nomeSensor: 'asc' },
    });
    expect(erros).toEqual([
      { nomeSensor: 'Pluviômetro', valor: 900, motivo: 'ACIMA_DO_MAXIMO', valorMinimo: 0, valorMaximo: 500, licitacaoId },
      { nomeSensor: 'Temperatura do ar', valor: -55, motivo: 'ABAIXO_DO_MINIMO', valorMinimo: -40, valorMaximo: 60, licitacaoId },
    ]);
  });

  it('RF05.14: a telemetria de estação inativa é armazenada sem gerar medida, alarme ou erro', async () => {
    const { vid, estacaoId } = await criarEstacao('INATIVA');

    const resposta = await enviar(vid, { Pluviômetro: 80, 'Temperatura do ar': 30 }).expect(202);
    expect(resposta.body).toMatchObject({ estacaoInativa: true });
    await processar();

    expect(await situacao(vid, estacaoId)).toEqual({ brutas: 1, medidas: 0, alarmes: 0, erros: 0 });
    const [bruta] = await prisma.$queryRaw<{ payload: unknown }[]>`SELECT payload FROM leituras_brutas WHERE "vidEstacao" = ${vid}`;
    expect(bruta.payload).toEqual({ Pluviômetro: 80, 'Temperatura do ar': 30 });
  });

  it('o reenvio do mesmo instante não duplica medida nem alarme', async () => {
    const { vid, estacaoId } = await criarEstacao('ATIVA');

    await enviar(vid, { Pluviômetro: 40 }).expect(202);
    await enviar(vid, { Pluviômetro: 40 }).expect(202);
    await processar();

    expect(await situacao(vid, estacaoId)).toEqual({ brutas: 2, medidas: 1, alarmes: 1, erros: 0 });
  });

  it('a estação reativada volta a gerar medidas', async () => {
    const { vid, estacaoId } = await criarEstacao('INATIVA');
    await enviar(vid, { Pluviômetro: 5 }, UNIXTIME).expect(202);
    await processar();

    await prisma.estacao.update({ where: { id: estacaoId }, data: { statusOperacional: 'ATIVA' } });
    await enviar(vid, { Pluviômetro: 6 }, UNIXTIME + 300).expect(202);
    await processar();

    expect(await situacao(vid, estacaoId)).toEqual({ brutas: 2, medidas: 1, alarmes: 0, erros: 0 });
  });
});
