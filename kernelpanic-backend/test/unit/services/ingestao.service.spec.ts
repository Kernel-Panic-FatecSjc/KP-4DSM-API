import { NotFoundException } from '@nestjs/common';
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
  const telemetriaMock = { registrarLeituraBruta: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    telemetriaMock.registrarLeituraBruta.mockResolvedValue('leitura-bruta-1');

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IngestaoService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: TelemetriaService, useValue: telemetriaMock },
      ],
    }).compile();

    service = module.get(IngestaoService);
  });

  describe('ingerir', () => {
    it('grava a leitura bruta associada ao vid, com o GPS enviado pelo dispositivo', async () => {
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
      expect(telemetriaMock.registrarLeituraBruta).toHaveBeenCalledWith({
        vidEstacao: VID_ESTACAO,
        payload: LEITURAS,
        latitude: -22.9,
        longitude: -45.1,
        unixtimeDispositivo: 1_760_000_000,
      });
      expect(resposta).toMatchObject({
        leituraBrutaId: 'leitura-bruta-1',
        estacaoId: 'estacao-1',
        sensoresRecebidos: 3,
      });
    });

    it('cai para as coordenadas do cadastro quando o dispositivo não envia GPS', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);

      await service.ingerir({ vid: VID_ESTACAO, leituras: LEITURAS });

      expect(telemetriaMock.registrarLeituraBruta).toHaveBeenCalledWith(
        expect.objectContaining({ latitude: -23.1, longitude: -45.8 }),
      );
    });

    it('usa o horário do servidor quando o lote não informa unixtime', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO_COM_COORDENADAS);
      const antes = Math.floor(Date.now() / 1000);

      await service.ingerir({ vid: VID_ESTACAO, leituras: LEITURAS });

      const [[gravada]] = telemetriaMock.registrarLeituraBruta.mock.calls;
      expect(gravada.unixtimeDispositivo).toBeGreaterThanOrEqual(antes);
    });

    it('lança NotFoundException quando o vid não corresponde a nenhuma estação', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(
        service.ingerir({ vid: 'DESCONHECIDA', leituras: LEITURAS }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(telemetriaMock.registrarLeituraBruta).not.toHaveBeenCalled();
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
