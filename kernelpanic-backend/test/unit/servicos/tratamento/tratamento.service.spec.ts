import { Logger } from '@nestjs/common';
import { TratamentoService } from '../../../../servicos/tratamento/tratamento.service';

const ESTACAO = {
  id: 'estacao-1',
  vid: 'ESP32-1',
  licitacaoId: 'licitacao-a',
  statusOperacional: 'ATIVA',
  parametros: [{ id: 'parametro-temp', tipoParametro: { nome: 'temperatura_c', valorMinimo: -40, valorMaximo: 80 } }],
};

function leitura(id: string, payload: Record<string, unknown>, vid = 'ESP32-1') {
  return { id, vidEstacao: vid, payload, unixtimeDispositivo: 1_760_000_000n, xidTransacao: 10n };
}

describe('TratamentoService', () => {
  const txMock = {
    $queryRaw: jest.fn(),
    $executeRaw: jest.fn(),
    estacao: { findMany: jest.fn() },
    medida: { createMany: jest.fn() },
    leituraErro: { createMany: jest.fn() },
  };
  const prismaMock = { $transaction: jest.fn(), $queryRaw: jest.fn() };
  let service: TratamentoService;

  /** O lote lê o marcador, o limite de xid e as leituras, nesta ordem. */
  function lerDoBanco(leituras: ReturnType<typeof leitura>[]) {
    txMock.$queryRaw
      .mockResolvedValueOnce([{ ultimoXid: 0n, ultimaLeituraId: '' }])
      .mockResolvedValueOnce([{ limite: 100n }])
      .mockResolvedValueOnce(leituras);
  }

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'error').mockImplementation(() => undefined);
    prismaMock.$transaction.mockImplementation((operacao: (tx: typeof txMock) => unknown) => operacao(txMock));
    txMock.estacao.findMany.mockResolvedValue([ESTACAO]);
    service = new TratamentoService(prismaMock as never, { get: jest.fn() } as never);
  });

  afterEach(() => {
    jest.restoreAllMocks();
  });

  describe('processarLote', () => {
    it('sem leituras novas, não grava nada nem move o marcador', async () => {
      lerDoBanco([]);

      await expect(service.processarLote()).resolves.toEqual({ leituras: 0, medidas: 0, erros: 0 });
      expect(txMock.medida.createMany).not.toHaveBeenCalled();
      expect(txMock.$executeRaw).not.toHaveBeenCalled();
    });

    it('grava as medidas do lote, ignorando duplicatas, e avança o marcador', async () => {
      lerDoBanco([leitura('b1', { temperatura_c: 25 }), leitura('b2', { temperatura_c: 26 })]);

      const resultado = await service.processarLote();

      expect(resultado).toEqual({ leituras: 2, medidas: 2, erros: 0 });
      expect(txMock.medida.createMany).toHaveBeenCalledWith(
        expect.objectContaining({ skipDuplicates: true, data: expect.arrayContaining([expect.objectContaining({ valor: 26 })]) }),
      );
      expect(txMock.leituraErro.createMany).not.toHaveBeenCalled();
      expect(txMock.$executeRaw).toHaveBeenCalledTimes(1);
    });

    it('manda para leituras_erro o valor fora da faixa e o sensor sem cadastro, sem virar medida', async () => {
      lerDoBanco([leitura('b1', { temperatura_c: 500 }), leitura('b2', { sensor_desconhecido: 1 })]);

      const resultado = await service.processarLote();

      expect(resultado).toEqual({ leituras: 2, medidas: 0, erros: 2 });
      expect(txMock.medida.createMany).not.toHaveBeenCalled();
      expect(txMock.leituraErro.createMany).toHaveBeenCalledWith(expect.objectContaining({ skipDuplicates: true }));
    });

    it('trata como erro a leitura de uma estação que não existe', async () => {
      txMock.estacao.findMany.mockResolvedValue([]);
      lerDoBanco([leitura('b1', { temperatura_c: 25 }, 'ESP32-SEM-CADASTRO')]);

      const resultado = await service.processarLote();

      expect(resultado).toMatchObject({ leituras: 1, medidas: 0 });
      expect(resultado.erros).toBeGreaterThan(0);
    });

    it('soma as leituras do lote ao total processado', async () => {
      lerDoBanco([leitura('b1', { temperatura_c: 25 })]);

      await service.processarLote();

      expect(service.estado().processadasDesdeInicio).toBe(1);
    });
  });

  describe('pendentes', () => {
    it('devolve a quantidade de leituras ainda não tratadas', async () => {
      prismaMock.$queryRaw.mockResolvedValue([{ total: 12n }]);

      await expect(service.pendentes()).resolves.toBe(12);
    });

    it('devolve 0 quando a consulta não traz linha', async () => {
      prismaMock.$queryRaw.mockResolvedValue([]);

      await expect(service.pendentes()).resolves.toBe(0);
    });
  });

  describe('agendar', () => {
    it('marca o ciclo como falho quando o lote lança erro, para ser relido depois', async () => {
      prismaMock.$transaction.mockRejectedValue(new Error('banco fora'));

      service.agendar();
      await new Promise((resolve) => setImmediate(resolve));

      expect(service.estado()).toMatchObject({ ultimoCicloOk: false, escutandoBanco: false });
    });

    it('repete o lote sem pausa enquanto ele vier cheio e para no incompleto', async () => {
      const cheio = new TratamentoService(prismaMock as never, { get: (c: string) => (c === 'TRATAMENTO_LOTE_TAMANHO' ? 1 : undefined) } as never);
      lerDoBanco([leitura('b1', { temperatura_c: 25 })]);
      lerDoBanco([]);

      cheio.agendar();
      await new Promise((resolve) => setImmediate(resolve));
      await new Promise((resolve) => setImmediate(resolve));

      expect(prismaMock.$transaction).toHaveBeenCalledTimes(2);
      expect(cheio.estado().ultimoCicloOk).toBe(true);
    });

    it('depois de encerrado, não agenda ciclo novo', async () => {
      await service.onModuleDestroy();

      service.agendar();

      expect(prismaMock.$transaction).not.toHaveBeenCalled();
    });
  });
});
