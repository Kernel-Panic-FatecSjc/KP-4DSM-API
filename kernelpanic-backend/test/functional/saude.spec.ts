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
  const leituraErro = { createMany: jest.fn() };
  const logAuditoria = { create: jest.fn() };
  const intervaloOriginal = process.env.INGESTAO_LOTE_INTERVALO_MS;

  beforeAll(async () => {
    // Sem o timer de 2 s da ingestão: ele refaria sozinho a gravação que o teste
    // de recuperação deixa falhar de propósito, e o 503 esperado dependeria da sorte.
    process.env.INGESTAO_LOTE_INTERVALO_MS = '600000';

    app = await criarAppDeTeste({
      prismaMock: {
        estacao,
        leituraErro,
        logAuditoria,
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
    leituraErro.createMany.mockResolvedValue({ count: 0 });
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
  });

  afterAll(async () => {
    await app.close();
    if (intervaloOriginal === undefined) delete process.env.INGESTAO_LOTE_INTERVALO_MS;
    else process.env.INGESTAO_LOTE_INTERVALO_MS = intervaloOriginal;
  });

  it('responde 200 com o estado de cada componente quando banco e ingestão estão saudáveis', async () => {
    const resposta = await request(app.getHttpServer()).get('/saude').expect(200);

    expect(resposta.body).toEqual({ banco: 'ok', ingestao: 'ok' });
  });

  it('responde 503 apontando o banco quando ele está indisponível', async () => {
    queryRaw.mockRejectedValueOnce(new Error('Banco indisponível'));

    const resposta = await request(app.getHttpServer()).get('/saude').expect(503);

    expect(resposta.body).toMatchObject({ banco: 'falha', ingestao: 'ok' });
  });

  it('responde 503 apontando a ingestão enquanto um lote falho espera nova tentativa, e volta a 200 quando ele grava', async () => {
    await ingestaoService.ingerir({
      vid: VID_ESTACAO,
      unixtime: 1_760_000_000,
      latitude: -22.9,
      longitude: -45.1,
      leituras: LEITURAS,
    });
    executeRawUnsafe.mockRejectedValueOnce(new Error('Falha temporária ao gravar leituras'));

    await ingestaoService.flush();

    const falha = await request(app.getHttpServer()).get('/saude').expect(503);
    expect(falha.body).toMatchObject({ banco: 'ok', ingestao: 'falha' });

    await ingestaoService.flush();

    const recuperada = await request(app.getHttpServer()).get('/saude').expect(200);
    expect(recuperada.body).toEqual({ banco: 'ok', ingestao: 'ok' });
  });

  it('não gera linha de auditoria de acesso: o monitoramento chama de poucos em poucos segundos', async () => {
    await request(app.getHttpServer()).get('/saude').expect(200);
    // o middleware registra no evento "finish" da resposta
    await new Promise((resolve) => setImmediate(resolve));

    expect(logAuditoria.create).not.toHaveBeenCalled();
  });
});
