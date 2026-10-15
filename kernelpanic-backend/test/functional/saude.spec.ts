import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { IngestaoService } from '../../src/ingestao/ingestao.service';
import { ESTACAO_COM_COORDENADAS, LEITURAS, VID_ESTACAO } from '../fixtures';
import { criarAppDeTeste } from '../helpers';

describe('Saúde (funcional)', () => {
  let app: INestApplication;
  let ingestaoService: IngestaoService;

  const estacao = { findUnique: jest.fn() };
  const executeRawUnsafe = jest.fn();
  const queryRaw = jest.fn();

  beforeAll(async () => {
    app = await criarAppDeTeste({
      prismaMock: {
        estacao,
        $executeRawUnsafe: executeRawUnsafe,
        $queryRaw: queryRaw,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
    });

    ingestaoService = app.get(IngestaoService);
  });

  beforeEach(async () => {
    await ingestaoService.flush();

    jest.clearAllMocks();

    estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);
    executeRawUnsafe.mockResolvedValue(1);
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  afterAll(async () => {
    await app.close();
  });

  it('deve retornar 200 quando banco e ingestão estão saudáveis', async () => {
    await request(app.getHttpServer())
      .get('/saude')
      .expect(200);
  });

  it('deve retornar 503 quando o banco de dados estiver indisponível', async () => {
    queryRaw.mockRejectedValueOnce(new Error('Banco indisponível'));

    await request(app.getHttpServer())
      .get('/saude')
      .expect(503);
  });

  it('deve retornar 503 quando o último flush da ingestão falhar', async () => {
    await ingestaoService.ingerir({
      vid: VID_ESTACAO,
      unixtime: 1_760_000_000,
      latitude: -22.9,
      longitude: -45.1,
      leituras: LEITURAS,
    });

    executeRawUnsafe.mockRejectedValueOnce(
      new Error('Falha ao gravar leituras'),
    );

    await ingestaoService.flush();

    expect(executeRawUnsafe).toHaveBeenCalled();
    expect(ingestaoService.obterEstadoFlush()).toBe('falha');

    await request(app.getHttpServer())
      .get('/saude')
      .expect(503);
  });
});