import { Logger } from '@nestjs/common';
import { AlarmesTempoRealService } from '../../../src/alarmes/tempo-real/alarmes-tempo-real.service';

function alarme(id: string, estacaoId = 'estacao-1', disparadoEm = new Date().toISOString()) {
  return { id, disparadoEm, estacao: { id: estacaoId } };
}

describe('AlarmesTempoRealService', () => {
  const alarmesMock = { buscarRecentes: jest.fn() };
  const gatewayMock = { emitirNovosAlarmes: jest.fn() };
  const configMock = { get: jest.fn() };
  const prismaMock = { estacao: { findMany: jest.fn() } };
  const alertaPublicoMock = { publicar: jest.fn() };
  let service: AlarmesTempoRealService;

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => undefined);
    alarmesMock.buscarRecentes.mockResolvedValue([]);
    prismaMock.estacao.findMany.mockResolvedValue([{ id: 'estacao-1', latitude: -23.2, longitude: -45.9 }]);
    service = new AlarmesTempoRealService(alarmesMock as never, gatewayMock as never, configMock as never, prismaMock as never, alertaPublicoMock as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processar', () => {
    it('emite os alarmes novos com a posição da estação', async () => {
      const novo = alarme('a1');
      alarmesMock.buscarRecentes.mockResolvedValue([novo]);

      await service.processar();

      expect(gatewayMock.emitirNovosAlarmes).toHaveBeenCalledWith([
        { alarme: novo, posicao: { latitude: -23.2, longitude: -45.9 } },
      ]);
    });

    it('republica o alerta público quando há alarme novo', async () => {
      alarmesMock.buscarRecentes.mockResolvedValue([alarme('a1')]);

      await service.processar();

      expect(alertaPublicoMock.publicar).toHaveBeenCalledTimes(1);
    });

    it('não emite nada quando não há alarmes recentes', async () => {
      await service.processar();

      expect(gatewayMock.emitirNovosAlarmes).not.toHaveBeenCalled();
      expect(alertaPublicoMock.publicar).not.toHaveBeenCalled();
    });

    it('não reemite o alarme que já foi enviado', async () => {
      alarmesMock.buscarRecentes.mockResolvedValue([alarme('a1')]);

      await service.processar();
      await service.processar();

      expect(gatewayMock.emitirNovosAlarmes).toHaveBeenCalledTimes(1);
    });

    it('não emite o alarme cuja estação não tem posição', async () => {
      alarmesMock.buscarRecentes.mockResolvedValue([alarme('a1', 'estacao-sumida')]);

      await service.processar();

      expect(gatewayMock.emitirNovosAlarmes).toHaveBeenCalledWith([]);
    });

    it('registra o erro, sem lançar, quando a busca falha, e processa de novo depois', async () => {
      alarmesMock.buscarRecentes.mockRejectedValueOnce(new Error('banco fora')).mockResolvedValue([alarme('a1')]);

      await expect(service.processar()).resolves.toBeUndefined();
      await service.processar();

      expect(Logger.prototype.error).toHaveBeenCalledTimes(1);
      expect(gatewayMock.emitirNovosAlarmes).toHaveBeenCalledTimes(1);
    });

    it('junta os avisos que chegam durante uma busca em uma busca extra só', async () => {
      let liberar: (valor: unknown[]) => void = () => undefined;
      alarmesMock.buscarRecentes.mockReturnValueOnce(new Promise((resolve) => (liberar = resolve))).mockResolvedValue([]);

      const primeira = service.processar();
      await service.processar();
      await service.processar();
      liberar([]);
      await primeira;

      expect(alarmesMock.buscarRecentes).toHaveBeenCalledTimes(2);
    });
  });

  describe('onModuleInit', () => {
    it('não escuta o banco quando o tempo real está desligado', async () => {
      configMock.get.mockReturnValue('false');

      await service.onModuleInit();

      expect(alarmesMock.buscarRecentes).not.toHaveBeenCalled();
    });
  });
});
