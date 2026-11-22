import { Test, TestingModule } from '@nestjs/testing';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SaudeService, TIMEOUT_BANCO_MS, VERSAO_DESENVOLVIMENTO, lerVersao } from '../../../src/saude/saude.service';

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

  describe('verificar', () => {
    it('informa o banco saudável', async () => {
      await expect(service.verificar()).resolves.toEqual({ banco: 'ok', versao: VERSAO_DESENVOLVIMENTO });
    });

    it('aponta o banco quando a consulta falha', async () => {
      queryRaw.mockRejectedValue(new Error('conexão recusada'));

      await expect(service.verificar()).resolves.toEqual({ banco: 'falha', versao: VERSAO_DESENVOLVIMENTO });
    });

    it('não pendura com o banco travado: dá o banco como em falha ao estourar o timeout', async () => {
      jest.useFakeTimers();
      queryRaw.mockReturnValue(new Promise(() => undefined));

      const resultado = service.verificar();
      await jest.advanceTimersByTimeAsync(TIMEOUT_BANCO_MS);

      await expect(resultado).resolves.toEqual({ banco: 'falha', versao: VERSAO_DESENVOLVIMENTO });
    });

    it('não deixa timer pendente quando o banco responde', async () => {
      jest.useFakeTimers();

      await service.verificar();

      expect(jest.getTimerCount()).toBe(0);
    });
  });

  describe('lerVersao', () => {
    let pasta: string;

    beforeEach(() => {
      pasta = mkdtempSync(join(tmpdir(), 'versao-'));
    });

    afterEach(() => {
      rmSync(pasta, { recursive: true, force: true });
    });

    it('lê o commit do arquivo VERSAO do pacote, encurtado para 7 caracteres', () => {
      const arquivo = join(pasta, 'VERSAO');
      writeFileSync(arquivo, 'commit=a6e8372f0c1b2d3e4f5a6b7c8d9e0f1a2b3c4d5e\r\ngerado_em=2026-11-22T02:00:00Z\r\nnode=v24.22.3\r\n');

      expect(lerVersao(arquivo)).toBe('a6e8372');
    });

    it('fora de um pacote (sem arquivo) informa "desenvolvimento"', () => {
      expect(lerVersao(join(pasta, 'nao-existe'))).toBe(VERSAO_DESENVOLVIMENTO);
    });

    it('não expõe conteúdo arbitrário quando o arquivo não tem um commit válido', () => {
      const arquivo = join(pasta, 'VERSAO');
      writeFileSync(arquivo, 'commit=<script>alert(1)</script>\n');

      expect(lerVersao(arquivo)).toBe(VERSAO_DESENVOLVIMENTO);
    });
  });
});
