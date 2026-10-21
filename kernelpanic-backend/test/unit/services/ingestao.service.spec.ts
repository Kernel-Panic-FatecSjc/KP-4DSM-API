import { Logger, NotFoundException, ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Test, TestingModule } from '@nestjs/testing';
import { IngestaoService } from '../../../src/ingestao/ingestao.service';
import { TelemetriaService } from '../../../src/ingestao/telemetria.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import {
  ESTACAO_COM_COORDENADAS,
  ESTACAO_COM_TIPOS,
  LEITURAS,
  TIPO_CHUVA,
  VID_ESTACAO,
} from '../../fixtures';

describe('IngestaoService', () => {
  let service: IngestaoService;
  const prismaMock = { estacao: { findUnique: jest.fn() } };
  const telemetriaMock = {
    registrarLeiturasBrutas: jest.fn(),
    registrarMedidas: jest.fn(),
    registrarLeiturasErro: jest.fn(),
  };
  const configMock = { get: jest.fn() };
  const REGEX_UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

  beforeEach(async () => {
    jest.clearAllMocks();
    // lote grande e intervalo alto: nos testes o flush é sempre manual, via service.flush()
    configMock.get.mockImplementation((chave: string) => {
      if (chave === 'INGESTAO_LOTE_TENTATIVAS_MAX') return 3;
      if (chave === 'INGESTAO_ENCERRAMENTO_PRAZO_MS') return 1000;
      return chave === 'INGESTAO_LOTE_TAMANHO_MAX' ? 999_999 : 999_999_999;
    });
    telemetriaMock.registrarLeiturasBrutas.mockResolvedValue(1);
    telemetriaMock.registrarMedidas.mockResolvedValue(1);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestaoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TelemetriaService, useValue: telemetriaMock },
        { provide: ConfigService, useValue: configMock },
      ],
    }).compile();

    service = module.get(IngestaoService);
  });

  afterEach(async () => {
    await service.onModuleDestroy();
  });

  describe('ingerir', () => {
    it('enfileira a leitura bruta associada ao vid e grava no flush, com o GPS enviado pelo dispositivo', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);

      const resposta = await service.ingerir({
        vid: VID_ESTACAO,
        unixtime: 1_760_000_000,
        latitude: -22.9,
        longitude: -45.1,
        leituras: LEITURAS,
      });

      expect(prismaMock.estacao.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { vid: VID_ESTACAO } }),
      );
      expect(resposta).toMatchObject({ estacaoId: 'estacao-1', sensoresRecebidos: 3 });
      expect(resposta.leituraBrutaId).toMatch(REGEX_UUID);
      // ainda não gravou: só acumulou no buffer até o próximo flush
      expect(telemetriaMock.registrarLeiturasBrutas).not.toHaveBeenCalled();

      await service.flush();

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledWith([
        {
          id: resposta.leituraBrutaId,
          vidEstacao: VID_ESTACAO,
          payload: LEITURAS,
          latitude: -22.9,
          longitude: -45.1,
          unixtimeDispositivo: 1_760_000_000,
        },
      ]);
    });

    it('cai para as coordenadas do cadastro quando o dispositivo não envia GPS', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);

      await service.ingerir({ vid: VID_ESTACAO, leituras: LEITURAS });
      await service.flush();

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledWith([
        expect.objectContaining({ latitude: -23.1, longitude: -45.8 }),
      ]);
    });

    it('usa o horário do servidor quando o lote não informa unixtime', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);
      const antes = Math.floor(Date.now() / 1000);

      await service.ingerir({ vid: VID_ESTACAO, leituras: LEITURAS });
      await service.flush();

      const [[[gravada]]] = telemetriaMock.registrarLeiturasBrutas.mock.calls;
      expect(gravada.unixtimeDispositivo).toBeGreaterThanOrEqual(antes);
    });

    it('lança NotFoundException quando o vid não corresponde a nenhuma estação', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(
        service.ingerir({ vid: 'DESCONHECIDA', leituras: LEITURAS }),
      ).rejects.toBeInstanceOf(NotFoundException);

      await service.flush();
      expect(telemetriaMock.registrarLeiturasBrutas).not.toHaveBeenCalled();
    });

    it('enfileira, casando pelo nome, só as leituras com tipoParametro configurado, e grava o lote no flush', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue({
        ...ESTACAO_COM_COORDENADAS,
        parametros: [{ id: 'parametro-temp', tipoParametro: { nome: 'temperatura' } }],
      });

      await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      expect(telemetriaMock.registrarMedidas).not.toHaveBeenCalled();

      await service.onModuleDestroy();

      expect(telemetriaMock.registrarMedidas).toHaveBeenCalledWith([
        {
          parametroId: 'parametro-temp',
          estacaoId: ESTACAO_COM_COORDENADAS.id,
          valor: LEITURAS.temperatura,
          unixtime: 1_760_000_000,
        },
      ]);
    });

    describe('faixa física e leituras com erro', () => {
      const estacaoComFaixa = (valorMinimo: number | null, valorMaximo: number | null) => ({
        ...ESTACAO_COM_COORDENADAS,
        parametros: [{ id: 'parametro-temp', tipoParametro: { nome: 'temperatura', valorMinimo, valorMaximo } }],
      });
      const ingerirTemperatura = (valor: number) =>
        service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: { temperatura: valor } });

      it('grava como medida o valor dentro da faixa e o igual a cada limite', async () => {
        prismaMock.estacao.findUnique.mockResolvedValue(estacaoComFaixa(-40, 60));

        await ingerirTemperatura(25);
        await ingerirTemperatura(-40);
        await ingerirTemperatura(60);
        await service.flush();

        expect(telemetriaMock.registrarMedidas).toHaveBeenCalledWith(
          [25, -40, 60].map((valor) => expect.objectContaining({ parametroId: 'parametro-temp', valor })),
        );
        expect(telemetriaMock.registrarLeiturasErro).not.toHaveBeenCalled();
      });

      it.each([
        [150, 'ACIMA_DO_MAXIMO'],
        [-40.5, 'ABAIXO_DO_MINIMO'],
      ])('não gera medida para %s e o registra em leituras_erro como %s, preservando o pacote', async (valor, motivo) => {
        prismaMock.estacao.findUnique.mockResolvedValue(estacaoComFaixa(-40, 60));

        const resposta = await ingerirTemperatura(valor);
        await service.flush();

        expect(resposta).toMatchObject({ sensoresRecebidos: 1 });
        expect(telemetriaMock.registrarMedidas).not.toHaveBeenCalled();
        expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledWith([
          expect.objectContaining({ id: resposta.leituraBrutaId, payload: { temperatura: valor } }),
        ]);
        expect(telemetriaMock.registrarLeiturasErro).toHaveBeenCalledWith([
          {
            id: expect.stringMatching(REGEX_UUID),
            leituraBrutaId: resposta.leituraBrutaId,
            vidEstacao: VID_ESTACAO,
            nomeSensor: 'temperatura',
            parametroId: 'parametro-temp',
            valor,
            unixtime: 1_760_000_000,
            motivo,
            valorMinimo: -40,
            valorMaximo: 60,
          },
        ]);
      });

      it('registra o sensor sem parâmetro na estação e segue gravando os outros', async () => {
        prismaMock.estacao.findUnique.mockResolvedValue(estacaoComFaixa(null, null));

        const resposta = await service.ingerir({
          vid: VID_ESTACAO,
          unixtime: 1_760_000_000,
          leituras: { temperatura: 25, sensorDesconhecido: 7 },
        });
        await service.flush();

        expect(telemetriaMock.registrarMedidas).toHaveBeenCalledWith([
          expect.objectContaining({ parametroId: 'parametro-temp', valor: 25 }),
        ]);
        expect(telemetriaMock.registrarLeiturasErro).toHaveBeenCalledWith([
          expect.objectContaining({
            leituraBrutaId: resposta.leituraBrutaId,
            nomeSensor: 'sensorDesconhecido',
            parametroId: null,
            valor: 7,
            motivo: 'SENSOR_NAO_CONFIGURADO',
            valorMinimo: null,
            valorMaximo: null,
          }),
        ]);
      });

      it('não checa faixa quando o parâmetro não tem limites', async () => {
        prismaMock.estacao.findUnique.mockResolvedValue(estacaoComFaixa(null, null));

        await ingerirTemperatura(1e6);
        await service.flush();

        expect(telemetriaMock.registrarMedidas).toHaveBeenCalledWith([expect.objectContaining({ valor: 1e6 })]);
        expect(telemetriaMock.registrarLeiturasErro).not.toHaveBeenCalled();
      });

      it('dá a cada leitura com erro um id próprio, para regravar o lote sem duplicar', async () => {
        prismaMock.estacao.findUnique.mockResolvedValue(estacaoComFaixa(0, 10));

        await ingerirTemperatura(99);
        await ingerirTemperatura(99);
        await service.flush();

        const [erros] = telemetriaMock.registrarLeiturasErro.mock.calls[0];
        expect(new Set(erros.map((e: { id: string }) => e.id)).size).toBe(2);
      });
    });

    it('reenvio do buffer (US03): dois ingerir() com mesmo unixtime fazem flush chamar registrarMedidas com ambas as medidas — skipDuplicates no banco descarta a duplicata', async () => {
      // Simula o cenário: ESP32 envia, API aceita, resposta não chega → reenvio.
      // O IngestaoService acumula as duas entradas no buffer antes do flush.
      prismaMock.estacao.findUnique.mockResolvedValue({
        ...ESTACAO_COM_COORDENADAS,
        parametros: [{ id: 'parametro-temp', tipoParametro: { nome: 'temperatura' } }],
      });

      await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: { temperatura: 25 } });
      await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: { temperatura: 25 } });

      await service.flush();

      // registrarMedidas recebe as duas entradas do buffer — o próprio
      // banco descarta a linha duplicada via ON CONFLICT DO NOTHING
      // (skipDuplicates: true no TelemetriaService.registrarMedidas).
      expect(telemetriaMock.registrarMedidas).toHaveBeenCalledTimes(1);
      expect(telemetriaMock.registrarMedidas).toHaveBeenCalledWith([
        { parametroId: 'parametro-temp', estacaoId: ESTACAO_COM_COORDENADAS.id, valor: 25, unixtime: 1_760_000_000 },
        { parametroId: 'parametro-temp', estacaoId: ESTACAO_COM_COORDENADAS.id, valor: 25, unixtime: 1_760_000_000 },
      ]);
    });
  });

  describe('flush com falha', () => {
    const FALHA = new Error('banco fora do ar');
    const ESTACAO_COM_TEMPERATURA = {
      ...ESTACAO_COM_COORDENADAS,
      parametros: [{ id: 'parametro-temp', tipoParametro: { nome: 'temperatura' } }],
    };

    beforeEach(() => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_TEMPERATURA);
    });

    const idsGravados = (chamada: number) =>
      telemetriaMock.registrarLeiturasBrutas.mock.calls[chamada][0].map((leitura: { id: string }) => leitura.id);

    it('devolve o lote à fila e grava na tentativa seguinte, junto com as leituras novas', async () => {
      telemetriaMock.registrarLeiturasBrutas.mockRejectedValueOnce(FALHA);

      const primeira = await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      await service.flush();
      const segunda = await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_060, leituras: LEITURAS });
      await service.flush();

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(2);
      expect(idsGravados(1)).toEqual([primeira.leituraBrutaId, segunda.leituraBrutaId]);

      await service.flush();
      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(2);
    });

    it('tenta de novo no próximo flush mesmo sem leituras novas', async () => {
      telemetriaMock.registrarLeiturasBrutas.mockRejectedValueOnce(FALHA);

      const leitura = await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      await service.flush();
      await service.flush();

      expect(idsGravados(1)).toEqual([leitura.leituraBrutaId]);
    });

    it('reenvia só o tipo que falhou', async () => {
      telemetriaMock.registrarMedidas.mockRejectedValueOnce(FALHA);

      await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      await service.flush();
      await service.flush();

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(1);
      expect(telemetriaMock.registrarMedidas).toHaveBeenCalledTimes(2);
      expect(telemetriaMock.registrarMedidas).toHaveBeenLastCalledWith([
        expect.objectContaining({ parametroId: 'parametro-temp', unixtime: 1_760_000_000 }),
      ]);
    });

    it('descarta com log de erro detalhado ao esgotar as tentativas', async () => {
      const logErro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      jest.spyOn(Logger.prototype, 'warn').mockImplementation();
      telemetriaMock.registrarLeiturasBrutas.mockRejectedValue(FALHA);

      const leitura = await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      for (let tentativa = 0; tentativa < 3; tentativa++) await service.flush();

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(3);
      const mensagens = logErro.mock.calls.map(([mensagem]) => String(mensagem)).join('\n');
      expect(mensagens).toContain('Descartando 1 leitura(s) bruta(s) após 3 tentativa(s) de gravação: banco fora do ar');
      expect(mensagens).toContain(leitura.leituraBrutaId);

      await service.flush();
      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(3);
      logErro.mockRestore();
    });

    it('insiste nas falhas ao encerrar até gravar o lote pendente', async () => {
      telemetriaMock.registrarLeiturasBrutas.mockRejectedValueOnce(FALHA);

      const leitura = await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      await service.onModuleDestroy();

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(2);
      expect(idsGravados(1)).toEqual([leitura.leituraBrutaId]);
    });

    it('o flush pedido durante outro espera ele terminar e reenvia o que falhou', async () => {
      let falharPrimeira!: (erro: Error) => void;
      telemetriaMock.registrarLeiturasBrutas.mockImplementationOnce(
        () => new Promise((_resolve, reject) => (falharPrimeira = reject)),
      );

      const leitura = await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      const primeiro = service.flush();
      await new Promise(setImmediate);
      const segundo = service.flush();

      falharPrimeira(FALHA);
      await Promise.all([primeiro, segundo]);

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(2);
      expect(idsGravados(1)).toEqual([leitura.leituraBrutaId]);
    });

    it('mantém no máximo um flush na fila', async () => {
      let liberarPrimeiro!: (total: number) => void;
      telemetriaMock.registrarLeiturasBrutas.mockImplementationOnce(
        () => new Promise((resolve) => (liberarPrimeiro = resolve)),
      );

      await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      const primeiro = service.flush();
      await new Promise(setImmediate);
      await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_060, leituras: LEITURAS });
      const naFila = [service.flush(), service.flush(), service.flush()];

      liberarPrimeiro(1);
      await Promise.all([primeiro, ...naFila]);

      expect(telemetriaMock.registrarLeiturasBrutas).toHaveBeenCalledTimes(2);
    });

    it('responde 503 às leituras que chegam depois de o encerramento começar', async () => {
      const encerramento = service.onModuleDestroy();

      await expect(
        service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS }),
      ).rejects.toBeInstanceOf(ServiceUnavailableException);
      await encerramento;
      expect(telemetriaMock.registrarLeiturasBrutas).not.toHaveBeenCalled();
    });

    it('descarta com log ao estourar o prazo de encerramento com o banco pendurado', async () => {
      const logErro = jest.spyOn(Logger.prototype, 'error').mockImplementation();
      telemetriaMock.registrarLeiturasBrutas.mockImplementation(() => new Promise(() => undefined));

      const leitura = await service.ingerir({ vid: VID_ESTACAO, unixtime: 1_760_000_000, leituras: LEITURAS });
      const inicio = Date.now();
      await service.onModuleDestroy();

      expect(Date.now() - inicio).toBeLessThan(2000);
      const mensagens = logErro.mock.calls.map(([mensagem]) => String(mensagem)).join('\n');
      expect(mensagens).toContain('Descartando 1 leitura(s) bruta(s) após encerramento sem concluir a gravação');
      expect(mensagens).toContain(leitura.leituraBrutaId);
      logErro.mockRestore();
      telemetriaMock.registrarLeiturasBrutas.mockReset();
    });
  });

  describe('listarParametros', () => {
    it('devolve os tipos de parâmetro da estação com os dados de calibração', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_TIPOS);

      const resposta = await service.listarParametros(VID_ESTACAO);

      expect(resposta).toEqual({
        estacaoId: 'estacao-1',
        vid: VID_ESTACAO,
        nome: 'Estação Centro',
        parametros: [
          { tipoParametroId: TIPO_CHUVA, nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2 },
        ],
      });
    });

    it('lança NotFoundException para vid desconhecido', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(service.listarParametros('DESCONHECIDA')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });
});
