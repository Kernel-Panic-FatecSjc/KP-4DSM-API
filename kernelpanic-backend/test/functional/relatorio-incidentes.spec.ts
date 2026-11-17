import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { PrismaService } from '../../src/prisma/prisma.service';
import { criarAppDeTeste, criarLicitacaoDeTeste, criarSessaoDeTeste } from '../helpers';

// Relatório 2 (US10) contra o banco: os alarmes nascem do trigger
// avaliar_alertas_lote a partir das medidas gravadas aqui, como na cadeia real.

const MIN = 60;
const DIA_10 = Date.UTC(2026, 2, 10, 12, 0, 0) / 1000; // 10/03/2026 12:00 UTC
const DIA_20 = Date.UTC(2026, 2, 20, 12, 0, 0) / 1000;

const NORTE = { latitude: -23.1, longitude: -45.9 };
const SUL = { latitude: -23.3, longitude: -45.9 }; // ~22 km ao sul

interface Resposta {
  ocorrencias: {
    estacao: { nome: string };
    severidade: string;
    duracaoSegundos: number;
    valorPico: number;
    leituras: number;
    inicio: string;
    fim: string;
    operador: string;
    valorLimite: number;
    parametro: { nome: string; unidade: string };
  }[];
  resumoPorSeveridade: { severidade: string; ocorrencias: number; duracaoTotalSegundos: number; leituras: number }[];
  resumoPorEstacao: { estacao: { nome: string }; ocorrencias: number }[];
}

describe('Relatório de incidentes (funcional)', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let cookie: string[];
  let licitacaoId: string;
  const sufixo = Date.now();
  const nomeNorte = `Estação Norte ${sufixo}`;
  const nomeSul = `Estação Sul ${sufixo}`;

  const consultar = (query: Record<string, string | number>) =>
    request(app.getHttpServer())
      .get('/relatorios/incidentes')
      .query({ de: '2026-03-01', ate: '2026-03-31', ...query })
      .set('Cookie', cookie)
      .expect(200)
      .then((resposta) => resposta.body as Resposta);

  const estacoes = (resposta: Resposta) => resposta.ocorrencias.map((ocorrencia) => ocorrencia.estacao.nome).sort();

  beforeAll(async () => {
    app = await criarAppDeTeste();
    prisma = app.get(PrismaService);

    licitacaoId = (await criarLicitacaoDeTeste(app)).id;
    const sessao = await criarSessaoDeTeste(app, 'ADMIN_LICITACAO', licitacaoId);
    cookie = sessao.cookie;

    const tipo = await prisma.tipoParametro.create({
      data: { nome: `Chuva incidentes ${sufixo}`, unidade: 'mm', fator: 1, ganho: 0, licitacaoId },
    });

    const criarEstacao = async (nome: string, endereco: string, posicao: typeof NORTE) => {
      const estacao = await prisma.estacao.create({
        data: { nome, endereco, vid: `incidentes-${nome}`, ...posicao, usuarioId: sessao.usuarioId, licitacaoId },
      });
      const parametro = await prisma.parametro.create({ data: { estacaoId: estacao.id, tipoParametroId: tipo.id } });
      return { estacaoId: estacao.id, parametroId: parametro.id };
    };
    const norte = await criarEstacao(nomeNorte, 'Bairro Norte, São José dos Campos - SP', NORTE);
    const sul = await criarEstacao(nomeSul, 'Bairro Sul, Jacareí - SP', SUL);

    await prisma.alerta.createMany({
      data: [
        { operador: 'MAIOR_QUE', valorLimite: 30, severidade: 'EMERGENCIA', parametroId: norte.parametroId, licitacaoId },
        { operador: 'MAIOR_QUE', valorLimite: 10, severidade: 'ATENCAO', parametroId: sul.parametroId, licitacaoId },
      ],
    });

    const medidas = (estacao: typeof norte, leituras: [number, number][]) =>
      leituras.map(([unixtime, valor]) => ({ ...estacao, licitacaoId, unixtime: BigInt(unixtime), valor }));

    // Norte: 4 leituras seguidas acima de 30 (15 min, pico 50), uma normal e,
    // 2 h depois do início, mais uma isolada (outra ocorrência, duração 0).
    // Sul: 2 leituras acima de 10 no dia 10 (5 min, pico 18) e uma no dia 20.
    await prisma.medida.createMany({
      data: [
        ...medidas(norte, [
          [DIA_10, 35],
          [DIA_10 + 5 * MIN, 50],
          [DIA_10 + 10 * MIN, 40],
          [DIA_10 + 15 * MIN, 32],
          [DIA_10 + 60 * MIN, 20],
          [DIA_10 + 120 * MIN, 45],
        ]),
        ...medidas(sul, [
          [DIA_10, 12],
          [DIA_10 + 5 * MIN, 18],
          [DIA_20, 15],
        ]),
      ],
    });
  }, 30_000);

  afterAll(async () => {
    await app.close();
  });

  it('sem filtro além do período: agrupa as ocorrências e resume por severidade e estação', async () => {
    const resposta = await consultar({});

    expect(resposta.ocorrencias).toHaveLength(4);
    expect(resposta.resumoPorSeveridade).toEqual([
      { severidade: 'ATENCAO', ocorrencias: 2, duracaoTotalSegundos: 5 * MIN, leituras: 3 },
      { severidade: 'ALERTA', ocorrencias: 0, duracaoTotalSegundos: 0, leituras: 0 },
      { severidade: 'EMERGENCIA', ocorrencias: 2, duracaoTotalSegundos: 15 * MIN, leituras: 5 },
    ]);
    expect(resposta.resumoPorEstacao.map((resumo) => [resumo.estacao.nome, resumo.ocorrencias]).sort()).toEqual([
      [nomeNorte, 2],
      [nomeSul, 2],
    ]);
  });

  it('calcula início, fim, duração, pico e o parâmetro violado de cada ocorrência', async () => {
    const resposta = await consultar({ severidade: 'EMERGENCIA' });
    const [isolada, continua] = resposta.ocorrencias; // mais recente primeiro

    expect(continua).toMatchObject({
      estacao: { nome: nomeNorte },
      inicio: new Date(DIA_10 * 1000).toISOString(),
      fim: new Date((DIA_10 + 15 * MIN) * 1000).toISOString(),
      duracaoSegundos: 15 * MIN,
      valorPico: 50,
      leituras: 4,
      operador: 'MAIOR_QUE',
      valorLimite: 30,
      parametro: { unidade: 'mm' },
    });
    expect(isolada).toMatchObject({ duracaoSegundos: 0, valorPico: 45, leituras: 1 });
  });

  it('filtra por severidade', async () => {
    const resposta = await consultar({ severidade: 'ATENCAO' });
    expect(estacoes(resposta)).toEqual([nomeSul, nomeSul]);
    expect((await consultar({ severidade: 'ALERTA' })).ocorrencias).toHaveLength(0);
  });

  it('filtra pelo período da leitura', async () => {
    const resposta = await consultar({ de: '2026-03-10', ate: '2026-03-10' });
    expect(resposta.ocorrencias).toHaveLength(3);
    expect((await consultar({ de: '2026-03-20', ate: '2026-03-20' })).ocorrencias).toHaveLength(1);
    expect((await consultar({ de: '2026-04-01', ate: '2026-04-30' })).ocorrencias).toHaveLength(0);
  });

  it('filtra pela região: raio em torno de um ponto e endereço da estação', async () => {
    expect(estacoes(await consultar({ ...NORTE, raioKm: 5 }))).toEqual([nomeNorte, nomeNorte]);
    expect(estacoes(await consultar({ ...SUL, raioKm: 5 }))).toEqual([nomeSul, nomeSul]);
    expect(estacoes(await consultar({ endereco: 'jacareí' }))).toEqual([nomeSul, nomeSul]);
  });

  it('combina os filtros', async () => {
    expect((await consultar({ severidade: 'EMERGENCIA', ...SUL, raioKm: 5 })).ocorrencias).toHaveLength(0);
    const combinado = await consultar({ severidade: 'ATENCAO', de: '2026-03-10', ate: '2026-03-10', endereco: 'Bairro Sul' });
    expect(combinado.ocorrencias).toHaveLength(1);
    expect(combinado.ocorrencias[0]).toMatchObject({ duracaoSegundos: 5 * MIN, valorPico: 18, leituras: 2 });
    expect(combinado.resumoPorSeveridade.find((resumo) => resumo.severidade === 'ATENCAO')).toMatchObject({
      ocorrencias: 1,
      duracaoTotalSegundos: 5 * MIN,
    });
  });

  it('a tolerância maior junta as leituras da estação Norte numa ocorrência só', async () => {
    const resposta = await consultar({ severidade: 'EMERGENCIA', toleranciaMinutos: 120 });
    expect(resposta.ocorrencias).toHaveLength(1);
    expect(resposta.ocorrencias[0]).toMatchObject({ duracaoSegundos: 120 * MIN, leituras: 5, valorPico: 50 });
  });

  it('registra a consulta e a emissão do laudo na trilha, com o identificador do laudo', async () => {
    const laudo = await request(app.getHttpServer())
      .get('/relatorios/incidentes/pdf')
      .query({ de: '2026-03-01', ate: '2026-03-31' })
      .set('Cookie', cookie)
      .expect(200);
    const laudoId = laudo.headers['x-laudo-id'];

    const registro = await prisma.logAuditoria.findFirst({ where: { acao: 'relatorios.incidentes.laudo', entidadeId: laudoId } });
    expect(registro).toMatchObject({ entidade: 'LaudoIncidentes', licitacaoId });
    expect(await prisma.logAuditoria.count({ where: { acao: 'relatorios.incidentes', licitacaoId } })).toBeGreaterThan(0);
  });

  it('recusa sem login com 401', async () => {
    await request(app.getHttpServer()).get('/relatorios/incidentes').query({ de: '2026-03-01', ate: '2026-03-31' }).expect(401);
    await request(app.getHttpServer()).get('/relatorios/incidentes/pdf').query({ de: '2026-03-01', ate: '2026-03-31' }).expect(401);
    await request(app.getHttpServer()).get('/relatorios/incidentes/csv').query({ de: '2026-03-01', ate: '2026-03-31' }).expect(401);
  });
});
