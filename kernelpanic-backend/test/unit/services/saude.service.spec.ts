import { Test, TestingModule } from '@nestjs/testing';
import { IngestaoService } from '../../../src/ingestao/ingestao.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SaudeService, TIMEOUT_BANCO_MS } from '../../../src/saude/saude.service';

describe('SaudeService', () => {
  let service: SaudeService;
  const queryRaw = jest.fn();
  const obterEstadoFlush = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);
    obterEstadoFlush.mockReturnValue('ok');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaudeService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
        { provide: IngestaoService, useValue: { obterEstadoFlush } },
      ],
    }).compile();

    service = module.get(SaudeService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('informa banco e ingestão saudáveis', async () => {
    await expect(service.verificar()).resolves.toEqual({ banco: 'ok', ingestao: 'ok' });
  });

  it('aponta o banco quando a consulta falha, sem mexer no estado da ingestão', async () => {
    queryRaw.mockRejectedValue(new Error('conexão recusada'));

    await expect(service.verificar()).resolves.toEqual({ banco: 'falha', ingestao: 'ok' });
  });

  it('aponta a ingestão enquanto há lote esperando nova tentativa', async () => {
    obterEstadoFlush.mockReturnValue('falha');

    await expect(service.verificar()).resolves.toEqual({ banco: 'ok', ingestao: 'falha' });
  });

  it('não pendura com o banco travado: dá o banco como em falha ao estourar o timeout', async () => {
    jest.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));

    const resultado = service.verificar();
    await jest.advanceTimersByTimeAsync(TIMEOUT_BANCO_MS);

    await expect(resultado).resolves.toEqual({ banco: 'falha', ingestao: 'ok' });
  });

  it('não deixa timer pendente quando o banco responde', async () => {
    jest.useFakeTimers();

    await service.verificar();

    expect(jest.getTimerCount()).toBe(0);
  });
});
