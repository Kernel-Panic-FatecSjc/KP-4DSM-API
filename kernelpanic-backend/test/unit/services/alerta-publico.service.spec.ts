import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Logger } from '@nestjs/common';
import { AlertaPublicoService } from '../../../src/alarmes/alerta-publico/alerta-publico.service';

const ALARME = {
  id: 'a1',
  disparadoEm: new Date('2026-11-20T10:00:00.000Z'),
  medida: { valor: 38.4 },
  alerta: {
    severidade: 'ALERTA',
    parametro: { estacao: { nome: 'Centro' }, tipoParametro: { nome: 'Temperatura', unidade: '°C' } },
  },
};

describe('AlertaPublicoService', () => {
  const prismaMock = { alarme: { findMany: jest.fn() } };
  let pasta: string;

  function criar(dir: string | undefined) {
    return new AlertaPublicoService(prismaMock as never, { get: () => dir } as never);
  }

  beforeEach(async () => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prismaMock.alarme.findMany.mockResolvedValue([ALARME]);
    pasta = await mkdtemp(join(tmpdir(), 'alerta-publico-'));
  });

  afterEach(async () => {
    jest.restoreAllMocks();
    await rm(pasta, { recursive: true, force: true });
  });

  describe('publicar', () => {
    it('grava o alerta só com os campos públicos', async () => {
      await criar(pasta).publicar();

      const { alertas, atualizadoEm } = JSON.parse(await readFile(join(pasta, 'alertas.json'), 'utf8'));
      expect(alertas).toEqual([
        { id: 'a1', severidade: 'ALERTA', estacao: 'Centro', parametro: 'Temperatura', unidade: '°C', valor: 38.4, disparadoEm: '2026-11-20T10:00:00.000Z' },
      ]);
      expect(atualizadoEm).toEqual(expect.any(String));
    });

    it('consulta só os alarmes ainda não resolvidos', async () => {
      await criar(pasta).publicar();

      expect(prismaMock.alarme.findMany.mock.calls[0][0].where.status).toEqual({ not: 'RESOLVIDO' });
    });

    it('sem alarmes, grava a lista vazia', async () => {
      prismaMock.alarme.findMany.mockResolvedValue([]);

      await criar(pasta).publicar();

      expect(JSON.parse(await readFile(join(pasta, 'alertas.json'), 'utf8')).alertas).toEqual([]);
    });

    it('não reescreve o arquivo quando a lista não mudou', async () => {
      const service = criar(pasta);
      await service.publicar();
      const antes = (await stat(join(pasta, 'alertas.json'))).mtimeMs;
      await new Promise((resolve) => setTimeout(resolve, 20));

      await service.publicar();

      expect((await stat(join(pasta, 'alertas.json'))).mtimeMs).toBe(antes);
    });

    it('reescreve quando um alerta some da lista', async () => {
      const service = criar(pasta);
      await service.publicar();
      prismaMock.alarme.findMany.mockResolvedValue([]);

      await service.publicar();

      expect(JSON.parse(await readFile(join(pasta, 'alertas.json'), 'utf8')).alertas).toEqual([]);
    });

    it('não faz nada sem a pasta configurada', async () => {
      await criar(undefined).publicar();

      expect(prismaMock.alarme.findMany).not.toHaveBeenCalled();
    });

    it('registra o erro, sem lançar, quando a consulta falha', async () => {
      prismaMock.alarme.findMany.mockRejectedValue(new Error('banco fora'));

      await expect(criar(pasta).publicar()).resolves.toBeUndefined();
      expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
    });
  });
});
