import { NotFoundException } from '@nestjs/common';
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
    configMock.get.mockImplementation((chave: string) =>
      chave === 'INGESTAO_LOTE_TAMANHO_MAX' ? 999_999 : 999_999_999,
    );

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
        expect(telemetriaMock.registrarLeiturasErro).toHaveBeenCalledWith([]);
      });

      it.each([
        [150, 'ACIMA_DO_MAXIMO'],
        [-40.5, 'ABAIXO_DO_MINIMO'],
      ])('não gera medida para %s e o registra em leituras_erro como %s, preservando o pacote', async (valor, motivo) => {
        prismaMock.estacao.findUnique.mockResolvedValue(estacaoComFaixa(-40, 60));

        const resposta = await ingerirTemperatura(valor);
        await service.flush();

        expect(resposta).toMatchObject({ sensoresRecebidos: 1 });
        expect(telemetriaMock.registrarMedidas).toHaveBeenCalledWith([]);
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
        expect(telemetriaMock.registrarLeiturasErro).toHaveBeenCalledWith([]);
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
