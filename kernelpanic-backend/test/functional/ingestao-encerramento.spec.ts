import { INestApplication } from '@nestjs/common';
import request from 'supertest';
import { HEADER_CHAVE_INGESTAO } from '../../servicos/ingestao/http/guarda-chave-ingestao.guard';
import { IngestaoAppModule } from '../../servicos/ingestao/ingestao.module';
import {
  CHAVE_INGESTAO,
  ESTACAO_COM_COORDENADAS,
  LEITURAS,
  VID_ESTACAO,
} from '../fixtures';
import { criarAppDeTeste } from '../helpers';

// O lote da ingestão fica em memória até o próximo flush; ao receber SIGTERM
// (ex.: deploy) o serviço de ingestão precisa gravá-lo antes de sair.
describe('Serviço de ingestão no encerramento (funcional)', () => {
  let app: INestApplication;
  const estacao = { findUnique: jest.fn() };
  const executeRawUnsafe = jest.fn();

  beforeAll(async () => {
    app = await criarAppDeTeste({
      modulo: IngestaoAppModule,
      prismaMock: {
        estacao,
        $executeRawUnsafe: executeRawUnsafe,
        $connect: jest.fn(),
        $disconnect: jest.fn(),
      },
    });
    // criarAppDeTeste aplica configurarApp, que liga os shutdown hooks como
    // o main.ts da ingestão
    estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);
    executeRawUnsafe.mockResolvedValue(1);
  });

  afterAll(async () => {
    jest.restoreAllMocks();
    await app.close();
  });

  it('grava o lote pendente ao receber SIGTERM', async () => {
    // o Nest reenvia o sinal ao próprio processo depois de encerrar a app,
    // o que derrubaria o Jest
    const sinalReenviado = new Promise<void>((resolve) => {
      jest.spyOn(process, 'kill').mockImplementation(() => {
        resolve();
        return true;
      });
    });

    const resposta = await request(app.getHttpServer())
      .post('/ingestao/telemetria')
      .set(HEADER_CHAVE_INGESTAO, CHAVE_INGESTAO)
      .send({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS })
      .expect(202);
    expect(executeRawUnsafe).not.toHaveBeenCalled();

    process.emit('SIGTERM', 'SIGTERM');
    await sinalReenviado;

    expect(executeRawUnsafe).toHaveBeenCalledTimes(1);
    expect(executeRawUnsafe.mock.calls[0]).toContain(
      resposta.body.leituraBrutaId,
    );
  });
});
