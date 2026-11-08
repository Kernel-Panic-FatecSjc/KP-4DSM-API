import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { criarAppDeTeste } from '../../helpers';
import { LICITACAO_A, LICITACAO_B } from '../sessoes';

const TECSUS = { id: 'tecsus-1', nome: 'Ana Tecsus', email: 'tecsus@teste.com', tipo: 'ADMIN_TECSUS', licitacaoId: null, licitacao: null, ativo: true };
const MONITOR = {
  id: 'monitor-1',
  email: 'monitor@teste.com',
  tipo: 'USUARIO_LICITACAO',
  licitacaoId: LICITACAO_A,
  licitacao: { status: 'VIGENTE' },
  ativo: true,
};

const T0 = 1_767_225_600; // 2026-01-01T00:00:00Z

function alarme(id: string, minuto: number, valor: number, severidade = 'EMERGENCIA', alertaId = 'alerta-1') {
  return {
    id,
    status: 'ABERTO',
    observacao: null,
    reconhecidoEm: null,
    resolvidoEm: null,
    reconhecidoPor: null,
    resolvidoPor: null,
    medida: { unixtime: BigInt(T0 + minuto * 60), valor },
    alerta: {
      id: alertaId,
      operador: 'MAIOR_QUE',
      valorLimite: 30,
      severidade,
      parametro: {
        estacao: { id: 'estacao-1', nome: 'Centro' },
        tipoParametro: { id: 'tipo-chuva', nome: 'Pluviômetro', unidade: 'mm' },
      },
    },
  };
}

describe('GET /relatorios/incidentes', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const usuario = { findUnique: jest.fn() };
  const logAuditoria = { create: jest.fn() };
  const alarmeMock = { findMany: jest.fn() };
  const licitacao = { findUnique: jest.fn() };
  const $queryRaw = jest.fn();

  const cookieDe = (u: { id: string; email: string }) => `access_token=${jwt.sign({ sub: u.id, email: u.email })}`;
  const consultar = (query: Record<string, string | number>, u: { id: string; email: string } = TECSUS) =>
    request(app.getHttpServer()).get('/relatorios/incidentes').query(query).set('Cookie', cookieDe(u));

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { usuario, logAuditoria, alarme: alarmeMock, licitacao, $queryRaw, $connect: jest.fn(), $disconnect: jest.fn() },
    });
    jwt = app.get(JwtService);
  }, 60_000);

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(TECSUS);
    alarmeMock.findMany.mockResolvedValue([
      alarme('a1', 0, 31),
      alarme('a2', 5, 45),
      alarme('a3', 10, 33),
      alarme('a4', 60, 50, 'ATENCAO', 'alerta-2'),
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('agrupa em ocorrências, resume por severidade e estação e audita a consulta', async () => {
    const resposta = await consultar({ de: '2026-01-01', ate: '2026-01-01', severidade: 'EMERGENCIA' }).expect(200);

    expect(resposta.body.ocorrencias).toHaveLength(2);
    expect(resposta.body.ocorrencias[1]).toMatchObject({
      alertaId: 'alerta-1',
      valorPico: 45,
      duracaoSegundos: 600,
      leituras: 3,
      operador: 'MAIOR_QUE',
      valorLimite: 30,
      parametro: { nome: 'Pluviômetro', unidade: 'mm' },
    });
    expect(resposta.body.resumoPorSeveridade).toEqual([
      { severidade: 'ATENCAO', ocorrencias: 1, duracaoTotalSegundos: 0, leituras: 1 },
      { severidade: 'ALERTA', ocorrencias: 0, duracaoTotalSegundos: 0, leituras: 0 },
      { severidade: 'EMERGENCIA', ocorrencias: 1, duracaoTotalSegundos: 600, leituras: 3 },
    ]);
    expect(resposta.body.resumoPorEstacao).toEqual([
      { estacao: { id: 'estacao-1', nome: 'Centro' }, ocorrencias: 2, duracaoTotalSegundos: 600, leituras: 4, maiorSeveridade: 'EMERGENCIA' },
    ]);

    const { where } = alarmeMock.findMany.mock.calls[0][0];
    expect(where.medida.unixtime).toEqual({ gte: BigInt(T0), lte: BigInt(T0 + 86_399) });
    expect(where.alerta.severidade).toBe('EMERGENCIA');

    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'relatorios.incidentes',
        entidade: 'RelatorioIncidentes',
        usuarioId: TECSUS.id,
        detalhes: expect.objectContaining({ severidade: 'EMERGENCIA', ocorrencias: 2, toleranciaMinutos: 15 }),
      }),
    });
  });

  it('filtra a região pelo raio (PostGIS) e pelo endereço da estação', async () => {
    $queryRaw.mockResolvedValue([{ id: 'estacao-1' }]);

    await consultar({ de: '2026-01-01', ate: '2026-01-31', latitude: -23.18, longitude: -45.88, raioKm: 10, endereco: 'Centro' }).expect(200);

    const { where } = alarmeMock.findMany.mock.calls[0][0];
    expect(where.alerta.parametro).toEqual({
      estacaoId: { in: ['estacao-1'] },
      estacao: { endereco: { contains: 'Centro', mode: 'insensitive' } },
    });
  });

  it('prende o usuário de licitação na dele e recusa outra com 403', async () => {
    usuario.findUnique.mockResolvedValue(MONITOR);

    await consultar({ de: '2026-01-01', ate: '2026-01-31' }, MONITOR).expect(200);
    expect(alarmeMock.findMany.mock.calls[0][0].where.alerta.licitacaoId).toBe(LICITACAO_A);

    await consultar({ de: '2026-01-01', ate: '2026-01-31', licitacaoId: LICITACAO_B }, MONITOR).expect(403);
  });

  it('valida período e região', async () => {
    await consultar({ ate: '2026-01-31' }).expect(400);
    await consultar({ de: '2026-02-01', ate: '2026-01-01' }).expect(400);
    await consultar({ de: '2026-01-01', ate: '2026-01-31', latitude: -23 }).expect(400);
    await consultar({ de: '2026-01-01', ate: '2026-01-31', raioKm: 10 }).expect(400);
    await consultar({ de: '2026-01-01', ate: '2026-01-31', severidade: 'GRAVE' }).expect(400);
    expect(alarmeMock.findMany).not.toHaveBeenCalled();
  });

  it('exige login', async () => {
    await request(app.getHttpServer()).get('/relatorios/incidentes').query({ de: '2026-01-01', ate: '2026-01-31' }).expect(401);
  });

  it('emite o laudo em PDF com identificador único registrado na auditoria', async () => {
    licitacao.findUnique.mockResolvedValue({
      orgaoNome: 'Prefeitura de São José dos Campos',
      orgaoMunicipio: 'São José dos Campos',
      orgaoUf: 'SP',
      numeroContrato: 'CT-01/2026',
      codigoIdentificador: 'PMSJC-2026',
    });

    const rota = await request(app.getHttpServer())
      .get('/relatorios/incidentes/pdf')
      .query({ de: '2026-01-01', ate: '2026-01-31', licitacaoId: LICITACAO_A })
      .set('Cookie', cookieDe(TECSUS))
      .buffer(true)
      .parse((res, callback) => {
        const partes: Buffer[] = [];
        res.on('data', (parte: Buffer) => partes.push(parte));
        res.on('end', () => callback(null, Buffer.concat(partes)));
      })
      .expect(200);

    expect(rota.headers['content-type']).toBe('application/pdf');
    const laudoId = rota.headers['x-laudo-id'];
    expect(laudoId).toMatch(/^[0-9a-f-]{36}$/);
    expect(rota.headers['content-disposition']).toContain(`laudo-incidentes-${laudoId}.pdf`);
    expect((rota.body as Buffer).subarray(0, 5).toString()).toBe('%PDF-');
    expect(licitacao.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: LICITACAO_A } }));
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        acao: 'relatorios.incidentes.laudo',
        entidade: 'LaudoIncidentes',
        entidadeId: laudoId,
        usuarioId: TECSUS.id,
        detalhes: expect.objectContaining({ ocorrencias: 2, licitacaoId: LICITACAO_A }),
      }),
    });
  });

  it('cada emissão gera um identificador novo', async () => {
    const emitir = () =>
      request(app.getHttpServer())
        .get('/relatorios/incidentes/pdf')
        .query({ de: '2026-01-01', ate: '2026-01-31' })
        .set('Cookie', cookieDe(TECSUS))
        .expect(200);
    const [primeiro, segundo] = [await emitir(), await emitir()];
    expect(primeiro.headers['x-laudo-id']).not.toBe(segundo.headers['x-laudo-id']);
  });

  it('exporta as ocorrências em CSV, uma linha por ocorrência, e audita', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/relatorios/incidentes/csv')
      .query({ de: '2026-01-01', ate: '2026-01-31' })
      .set('Cookie', cookieDe(TECSUS))
      .expect(200);

    expect(resposta.headers['content-type']).toContain('text/csv');
    const linhas = resposta.text.replace(/^\uFEFF/, '').trim().split('\r\n');
    expect(linhas).toHaveLength(3);
    expect(linhas[0]).toContain('Início;Fim;Duração (s);Estação;Parâmetro');
    expect(linhas.some((linha) => linha.includes(';600;Centro;Pluviômetro;mm;MAIOR_QUE;30;45;3;EMERGENCIA;ABERTO;'))).toBe(true);
    expect(logAuditoria.create).toHaveBeenCalledWith({
      data: expect.objectContaining({ acao: 'relatorios.incidentes.exportar', entidade: 'RelatorioIncidentes' }),
    });
  });

  it('PDF e CSV exigem login e validam os filtros', async () => {
    await request(app.getHttpServer()).get('/relatorios/incidentes/pdf').query({ de: '2026-01-01', ate: '2026-01-31' }).expect(401);
    await request(app.getHttpServer()).get('/relatorios/incidentes/csv').query({ de: '2026-01-01', ate: '2026-01-31' }).expect(401);
    await request(app.getHttpServer()).get('/relatorios/incidentes/pdf').query({ de: '2026-01-01' }).set('Cookie', cookieDe(TECSUS)).expect(400);
  });

  it('documenta a rota no Swagger', async () => {
    const resposta = await request(app.getHttpServer()).get('/docs-json').expect(200);
    const rota = resposta.body.paths['/relatorios/incidentes'].get;

    expect(rota.parameters.map((p: { name: string }) => p.name)).toEqual(
      expect.arrayContaining(['de', 'ate', 'severidade', 'latitude', 'longitude', 'raioKm', 'endereco', 'toleranciaMinutos']),
    );
    expect(rota.responses['200'].content['application/json'].schema.$ref).toContain('RelatorioIncidentesDto');
  });
});
