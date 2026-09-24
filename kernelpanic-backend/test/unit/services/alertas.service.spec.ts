import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlertasService } from '../../../src/alertas/alertas.service';
import { CriarAlertaDto } from '../../../src/alertas/dto/criar-alerta.dto';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ALERTA_COM_RELACOES, NOVO_ALERTA, PARAMETRO_CHUVA } from '../../fixtures';

describe('AlertasService', () => {
  let service: AlertasService;
  const prismaMock = {
    parametro: { findUnique: jest.fn() },
    alerta: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertasService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(AlertasService);
  });

  describe('criar', () => {
    it('persiste a regra com parâmetro, limiar e severidade quando o parâmetro existe', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({ id: PARAMETRO_CHUVA });
      prismaMock.alerta.create.mockResolvedValue(ALERTA_COM_RELACOES);

      const alerta = await service.criar(NOVO_ALERTA as CriarAlertaDto);

      expect(prismaMock.parametro.findUnique).toHaveBeenCalledWith({ where: { id: PARAMETRO_CHUVA } });
      expect(prismaMock.alerta.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: NOVO_ALERTA }),
      );
      expect(alerta).toBe(ALERTA_COM_RELACOES);
    });

    it('lança BadRequestException quando o parâmetro monitorado não existe', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);

      await expect(service.criar(NOVO_ALERTA as CriarAlertaDto)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.alerta.create).not.toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    it('lança NotFoundException quando o alerta não existe', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('inexistente', { valorLimite: 40 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });

    it('lança BadRequestException ao trocar para um parâmetro monitorado inexistente', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(ALERTA_COM_RELACOES);
      prismaMock.parametro.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizar(ALERTA_COM_RELACOES.id, { parametroId: PARAMETRO_CHUVA }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });

    it('não consulta o parâmetro quando ele não é alterado', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(ALERTA_COM_RELACOES);
      prismaMock.alerta.update.mockResolvedValue({ ...ALERTA_COM_RELACOES, valorLimite: 40 });

      await service.atualizar(ALERTA_COM_RELACOES.id, { valorLimite: 40 });

      expect(prismaMock.parametro.findUnique).not.toHaveBeenCalled();
      expect(prismaMock.alerta.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ALERTA_COM_RELACOES.id }, data: { valorLimite: 40 } }),
      );
    });
  });

  describe('inativar', () => {
    it('desativa em vez de apagar, para não levar junto os alarmes disparados', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(ALERTA_COM_RELACOES);
      prismaMock.alerta.update.mockResolvedValue({ ...ALERTA_COM_RELACOES, ativo: false });

      const alerta = await service.inativar(ALERTA_COM_RELACOES.id);

      expect(prismaMock.alerta.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ALERTA_COM_RELACOES.id }, data: { ativo: false } }),
      );
      expect(alerta.ativo).toBe(false);
    });

    it('lança NotFoundException quando o alerta não existe', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(null);

      await expect(service.inativar('sumido')).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });
  });
});
