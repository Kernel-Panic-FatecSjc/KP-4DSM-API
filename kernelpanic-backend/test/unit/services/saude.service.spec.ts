import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SaudeService, TIMEOUT_BANCO_MS } from '../../../src/saude/saude.service';

describe('SaudeService', () => {
  let service: SaudeService;
  const queryRaw = jest.fn();

  beforeEach(async () => {
    jest.clearAllMocks();
    queryRaw.mockResolvedValue([{ '?column?': 1 }]);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        SaudeService,
        { provide: PrismaService, useValue: { $queryRaw: queryRaw } },
      ],
    }).compile();

    service = module.get(SaudeService);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('informa o banco saudável', async () => {
    await expect(service.verificar()).resolves.toEqual({ banco: 'ok' });
  });

  it('aponta o banco quando a consulta falha', async () => {
    queryRaw.mockRejectedValue(new Error('conexão recusada'));

    await expect(service.verificar()).resolves.toEqual({ banco: 'falha' });
  });

  it('não pendura com o banco travado: dá o banco como em falha ao estourar o timeout', async () => {
    jest.useFakeTimers();
    queryRaw.mockReturnValue(new Promise(() => undefined));

    const resultado = service.verificar();
    await jest.advanceTimersByTimeAsync(TIMEOUT_BANCO_MS);

    await expect(resultado).resolves.toEqual({ banco: 'falha' });
  });

  it('não deixa timer pendente quando o banco responde', async () => {
    jest.useFakeTimers();

    await service.verificar();

    expect(jest.getTimerCount()).toBe(0);
  });
});
