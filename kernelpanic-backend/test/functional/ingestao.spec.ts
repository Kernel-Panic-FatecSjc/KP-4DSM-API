import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { ESTACAO_COM_COORDENADAS, ESTACAO_COM_TIPOS, LEITURAS, TIPO_CHUVA, VID_ESTACAO } from '../fixtures';
import { criarAppDeTeste } from '../helpers';

describe('Ingestão (funcional)', () => {
  let app: INestApplication;
  const estacao = { findUnique: jest.fn() };
  const queryRaw = jest.fn();

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: { estacao, $queryRaw: queryRaw, $connect: jest.fn(), $disconnect: jest.fn() },
    });
  });

  beforeEach(() => {
    jest.clearAllMocks();
    estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);
    queryRaw.mockResolvedValue([{ id: 'leitura-bruta-1' }]);
  });

  afterAll(async () => {
    await app.close();
  });

  const postar = (payload: object) =>
    request(app.getHttpServer()).post('/ingestao/telemetria').send(payload);

  it('aceita um payload válido e responde 202 ao dispositivo', async () => {
    const resposta = await postar({
      vid: VID_ESTACAO,
      unixtime: 1_760_000_000,
      latitude: -22.9,
      longitude: -45.1,
      leituras: LEITURAS,
    }).expect(202);

    expect(resposta.body).toMatchObject({
      leituraBrutaId: 'leitura-bruta-1',
      estacaoId: 'estacao-1',
      sensoresRecebidos: 3,
    });
    expect(typeof resposta.body.recebidoEm).toBe('number');
    expect(queryRaw).toHaveBeenCalledTimes(1);
  });

  it('descarta campos desconhecidos do payload (whitelist)', async () => {
    await postar({ vid: VID_ESTACAO, bateria: 3.7, leituras: LEITURAS }).expect(202);
  });

  it('rejeita payload malformado com 400 sem gravar nada', async () => {
    await postar({ vid: VID_ESTACAO }).expect(400);
    await postar({ vid: VID_ESTACAO, leituras: {} }).expect(400);
    await postar({ vid: VID_ESTACAO, leituras: { temperatura: 'quente' } }).expect(400);
    await postar({ vid: VID_ESTACAO, unixtime: 0, leituras: LEITURAS }).expect(400);
    await postar({ vid: VID_ESTACAO, latitude: 120, leituras: LEITURAS }).expect(400);

    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('responde 404 quando o vid não existe', async () => {
    estacao.findUnique.mockResolvedValue(null);

    await postar({ vid: 'DESCONHECIDA', leituras: LEITURAS }).expect(404);
    expect(queryRaw).not.toHaveBeenCalled();
  });

  it('expõe a configuração de sensores da estação para o datalogger', async () => {
    estacao.findUnique.mockResolvedValue(ESTACAO_COM_TIPOS);

    const resposta = await request(app.getHttpServer())
      .get(`/ingestao/estacoes/${VID_ESTACAO}/parametros`)
      .expect(200);

    expect(resposta.body.parametros).toEqual([
      { tipoParametroId: TIPO_CHUVA, nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2 },
    ]);
  });
});
