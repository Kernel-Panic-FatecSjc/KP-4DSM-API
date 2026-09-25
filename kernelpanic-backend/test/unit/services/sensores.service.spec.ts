import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SensoresService } from '../../../src/sensores/sensores.service';
import { UnidadeSensor } from '../../../src/sensores/unidade-sensor';

const SENSOR = {
  id: 'sensor-1',
  nome: 'Pluviômetro',
  unidade: 'mm',
  fator: 1,
  ganho: 0.2,
  json: null,
  _count: { parametros: 0 },
};

describe('SensoresService', () => {
  let service: SensoresService;
  const prismaMock = {
    tipoParametro: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.tipoParametro.findFirst.mockResolvedValue(null);
    prismaMock.tipoParametro.create.mockResolvedValue(SENSOR);
    prismaMock.tipoParametro.update.mockImplementation(({ data }) => ({ ...SENSOR, ...data }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [SensoresService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(SensoresService);
  });

  describe('criar', () => {
    it('cadastra o sensor com unidade e calibração', async () => {
      const sensor = await service.criar({ nome: 'Pluviômetro', unidade: UnidadeSensor.MILIMETRO, fator: 1, ganho: 0.2 });

      expect(prismaMock.tipoParametro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2 }),
        }),
      );
      expect(sensor).toBe(SENSOR);
    });

    it('recusa nome repetido, ignorando maiúsculas', async () => {
      prismaMock.tipoParametro.findFirst.mockResolvedValue({ id: 'sensor-1' });

      await expect(
        service.criar({ nome: 'pluviômetro', unidade: UnidadeSensor.MILIMETRO, fator: 1, ganho: 0.2 }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.tipoParametro.create).not.toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    it('altera só os campos enviados', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.atualizar('sensor-1', { ganho: 0.5 });

      expect(prismaMock.tipoParametro.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sensor-1' } }),
      );
      expect(prismaMock.tipoParametro.findFirst).not.toHaveBeenCalled();
    });

    it('não checa conflito quando o nome não muda', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.atualizar('sensor-1', { nome: SENSOR.nome });

      expect(prismaMock.tipoParametro.findFirst).not.toHaveBeenCalled();
    });

    it('ignora o próprio sensor ao checar o nome, permitindo mudar só a caixa', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.atualizar('sensor-1', { nome: 'PLUVIÔMETRO' });

      expect(prismaMock.tipoParametro.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ id: { not: 'sensor-1' } }),
        }),
      );
      expect(prismaMock.tipoParametro.update).toHaveBeenCalled();
    });

    it('recusa renomear para o nome de outro sensor', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);
      prismaMock.tipoParametro.findFirst.mockResolvedValue({ id: 'sensor-2' });

      await expect(service.atualizar('sensor-1', { nome: 'Anemômetro' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaMock.tipoParametro.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o sensor não existe', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('sumido', { ganho: 1 })).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remover', () => {
    it('exclui o sensor que não está associado a nenhuma estação', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.remover('sensor-1');

      expect(prismaMock.tipoParametro.delete).toHaveBeenCalledWith({ where: { id: 'sensor-1' } });
    });

    it('recusa excluir sensor em uso por alguma estação', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue({
        ...SENSOR,
        _count: { parametros: 2 },
      });

      await expect(service.remover('sensor-1')).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.tipoParametro.delete).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o sensor não existe', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(null);

      await expect(service.remover('sumido')).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.tipoParametro.delete).not.toHaveBeenCalled();
    });
  });
});
