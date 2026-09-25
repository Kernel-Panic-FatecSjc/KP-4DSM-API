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
  const telemetriaMock = { registrarLeiturasBrutas: jest.fn(), registrarMedidas: jest.fn() };
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
