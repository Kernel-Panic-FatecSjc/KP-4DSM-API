import { INestApplication } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import request from 'supertest';
import { criarAppDeTeste } from '../../helpers';

const USUARIO = {
  id: 'usuario-relatorio',
  email: 'relatorio@teste.com',
  tipo: 'ADMIN_TECSUS',
  licitacaoId: null,
  licitacao: null,
  ativo: true,
};
const ESTACAO_ID = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const TIPO_ID = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('GET /relatorios/historico-climatico', () => {
  let app: INestApplication;
  let cookie: string;
  const usuario = { findUnique: jest.fn() };
  const logAuditoria = { create: jest.fn() };
  const $queryRaw = jest.fn();

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { usuario, logAuditoria, $queryRaw },
    });
    cookie = `access_token=${app.get(JwtService).sign({ sub: USUARIO.id, email: USUARIO.email })}`;
  });

  beforeEach(() => {
    jest.clearAllMocks();
    usuario.findUnique.mockResolvedValue(USUARIO);
    $queryRaw.mockResolvedValue([
      {
        estacaoId: ESTACAO_ID,
        estacaoNome: 'Estação Centro',
        tipoParametroId: TIPO_ID,
        tipoParametroNome: 'Pluviômetro',
        unidade: 'mm',
        agregacao: 'SOMA',
        periodo: new Date('2026-01-01T00:00:00.000Z'),
        totalPeriodo: 0,
        valor: 5,
        soma: 5,
        media: 2.5,
        minimo: 1,
        maximo: 4,
        leituras: 2n,
      },
      {
        estacaoId: ESTACAO_ID,
        estacaoNome: 'Estação Centro',
        tipoParametroId: TIPO_ID,
        tipoParametroNome: 'Pluviômetro',
        unidade: 'mm',
        agregacao: 'SOMA',
        periodo: null,
        totalPeriodo: 1,
        valor: 5,
        soma: 5,
        media: 2.5,
        minimo: 1,
        maximo: 4,
        leituras: 2n,
      },
    ]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('retorna dados consolidados, aceita lista de estações e audita a consulta', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/relatorios/historico-climatico')
      .query({
        de: '2026-01-01',
        ate: '2026-01-01',
        granularidade: 'dia',
        'estacaoIds[]': [ESTACAO_ID],
      })
      .set('Cookie', cookie)
      .expect(200);

    expect(resposta.body.estacoes[0].parametros[0]).toMatchObject({
      agregacao: 'SOMA',
      periodos: [{ valor: 5, soma: 5 }],
      totalPeriodo: { valor: 5, soma: 5, leituras: 2 },
    });
    expect(logAuditoria.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          acao: 'relatorios.historico-climatico',
          entidade: 'RelatorioHistoricoClimatico',
          detalhes: expect.objectContaining({
            granularidade: 'dia',
            estacaoIds: [ESTACAO_ID],
          }),
        }),
      }),
    );
  });

  it('rejeita filtros inválidos e exige autenticação', async () => {
    await request(app.getHttpServer())
      .get(
        '/relatorios/historico-climatico?de=ontem&ate=2026-01-01&granularidade=dia',
      )
      .set('Cookie', cookie)
      .expect(400);
    await request(app.getHttpServer())
      .get(
        '/relatorios/historico-climatico?de=2026-01-01&ate=2026-01-02&granularidade=dia',
      )
      .expect(401);

    expect($queryRaw).not.toHaveBeenCalled();
  });

  it('documenta os filtros e a resposta no Swagger', async () => {
    const resposta = await request(app.getHttpServer())
      .get('/docs-json')
      .expect(200);

    expect(
      resposta.body.paths['/relatorios/historico-climatico'].get.parameters,
    ).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'de', required: true }),
        expect.objectContaining({ name: 'ate', required: true }),
        expect.objectContaining({ name: 'granularidade', required: true }),
        expect.objectContaining({ name: 'estacaoIds', required: false }),
      ]),
    );
  });
});
