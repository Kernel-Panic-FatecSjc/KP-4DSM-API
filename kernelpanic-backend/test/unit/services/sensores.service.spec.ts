import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { SensoresService } from '../../../src/sensores/sensores.service';
import { UnidadeSensor } from '../../../src/sensores/unidade-sensor';
import { ADMIN_A, ADMIN_B, LICITACAO_A, TECSUS } from '../sessoes';

const SENSOR = {
  id: 'sensor-1',
  nome: 'Pluviômetro',
  unidade: 'mm',
  fator: 1,
  ganho: 0.2,
  json: null,
  valorMinimo: null,
  valorMaximo: null,
  licitacaoId: LICITACAO_A,
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
    licitacao: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.tipoParametro.findFirst.mockResolvedValue(null);
    prismaMock.licitacao.findUnique.mockResolvedValue({ status: 'VIGENTE' });
    prismaMock.tipoParametro.create.mockResolvedValue(SENSOR);
    prismaMock.tipoParametro.update.mockImplementation(({ data }) => ({ ...SENSOR, ...data }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [SensoresService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(SensoresService);
  });

  describe('criar', () => {
    it('cadastra o sensor com unidade e calibração', async () => {
      const sensor = await service.criar({ nome: 'Pluviômetro', unidade: UnidadeSensor.MILIMETRO, fator: 1, ganho: 0.2 }, ADMIN_A);

      expect(prismaMock.tipoParametro.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ nome: 'Pluviômetro', unidade: 'mm', fator: 1, ganho: 0.2 }),
        }),
      );
      expect(sensor).toBe(SENSOR);
    });

    it('cadastra a faixa física, e mínimo igual ao máximo é uma faixa de um valor só', async () => {
      const base = { nome: 'Termômetro', unidade: UnidadeSensor.MILIMETRO, fator: 1, ganho: 0 };

      await service.criar({ ...base, valorMinimo: -40, valorMaximo: 60 }, ADMIN_A);
      expect(prismaMock.tipoParametro.create).toHaveBeenLastCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ valorMinimo: -40, valorMaximo: 60 }) }),
      );

      await service.criar({ ...base, valorMinimo: 5, valorMaximo: 5 }, ADMIN_A);
      expect(prismaMock.tipoParametro.create).toHaveBeenCalledTimes(2);
    });

    it('recusa faixa com mínimo maior que o máximo, sem gravar', async () => {
      await expect(
        service.criar({ nome: 'Termômetro', unidade: UnidadeSensor.MILIMETRO, fator: 1, ganho: 0, valorMinimo: 10, valorMaximo: 9 }, ADMIN_A),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.tipoParametro.create).not.toHaveBeenCalled();
    });

    it('recusa nome repetido, ignorando maiúsculas', async () => {
      prismaMock.tipoParametro.findFirst.mockResolvedValue({ id: 'sensor-1' });

      await expect(
        service.criar({ nome: 'pluviômetro', unidade: UnidadeSensor.MILIMETRO, fator: 1, ganho: 0.2 }, ADMIN_A),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.tipoParametro.create).not.toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    it('altera só os campos enviados', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.atualizar('sensor-1', { ganho: 0.5 }, TECSUS);

      expect(prismaMock.tipoParametro.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'sensor-1' } }),
      );
      expect(prismaMock.tipoParametro.findFirst).not.toHaveBeenCalled();
    });

    it('confere a faixa final contra o limite que já estava cadastrado', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue({ ...SENSOR, valorMinimo: 0, valorMaximo: 100 });

      await expect(service.atualizar('sensor-1', { valorMaximo: -1 }, TECSUS)).rejects.toBeInstanceOf(BadRequestException);
      await expect(service.atualizar('sensor-1', { valorMinimo: 101 }, TECSUS)).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.tipoParametro.update).not.toHaveBeenCalled();

      await service.atualizar('sensor-1', { valorMinimo: 100 }, TECSUS);
      expect(prismaMock.tipoParametro.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ valorMinimo: 100 }) }),
      );
    });

    it('limpa um limite com null e aceita o outro sozinho', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue({ ...SENSOR, valorMinimo: 0, valorMaximo: 100 });

      await service.atualizar('sensor-1', { valorMaximo: null }, TECSUS);

      expect(prismaMock.tipoParametro.update).toHaveBeenCalledWith(
        expect.objectContaining({ data: expect.objectContaining({ valorMaximo: null }) }),
      );
    });

    it('não checa conflito quando o nome não muda', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.atualizar('sensor-1', { nome: SENSOR.nome }, TECSUS);

      expect(prismaMock.tipoParametro.findFirst).not.toHaveBeenCalled();
    });

    it('ignora o próprio sensor ao checar o nome, permitindo mudar só a caixa', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.atualizar('sensor-1', { nome: 'PLUVIÔMETRO' }, TECSUS);

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

      await expect(service.atualizar('sensor-1', { nome: 'Anemômetro' }, TECSUS)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaMock.tipoParametro.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o sensor não existe', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('sumido', { ganho: 1 }, TECSUS)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('remover', () => {
    it('exclui o sensor que não está associado a nenhuma estação', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await service.remover('sensor-1', TECSUS);

      expect(prismaMock.tipoParametro.delete).toHaveBeenCalledWith({ where: { id: 'sensor-1' } });
    });

    it('recusa excluir sensor em uso por alguma estação', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue({
        ...SENSOR,
        _count: { parametros: 2 },
      });

      await expect(service.remover('sensor-1', TECSUS)).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.tipoParametro.delete).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o sensor não existe', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(null);

      await expect(service.remover('sumido', TECSUS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.tipoParametro.delete).not.toHaveBeenCalled();
    });
  });

  describe('escopo de licitação', () => {
    it('cria o sensor na licitação do admin dela', async () => {
      await service.criar({ nome: 'Termômetro', unidade: UnidadeSensor.GRAU_CELSIUS, fator: 1, ganho: 0 }, ADMIN_A);

      expect(prismaMock.tipoParametro.create.mock.calls[0][0].data.licitacaoId).toBe(LICITACAO_A);
    });

    it('a Tecsus precisa informar a licitação', async () => {
      await expect(
        service.criar({ nome: 'Termômetro', unidade: UnidadeSensor.GRAU_CELSIUS, fator: 1, ganho: 0 }, TECSUS),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('o nome só precisa ser único dentro da licitação', async () => {
      await service.criar({ nome: 'Termômetro', unidade: UnidadeSensor.GRAU_CELSIUS, fator: 1, ganho: 0 }, ADMIN_A);

      expect(prismaMock.tipoParametro.findFirst.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
    });

    it('nega editar ou remover sensor de outra licitação', async () => {
      prismaMock.tipoParametro.findUnique.mockResolvedValue(SENSOR);

      await expect(service.atualizar('sensor-1', { ganho: 1 }, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.remover('sensor-1', ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
    });

    it('lista paginado, preso à licitação do usuário', async () => {
      prismaMock.tipoParametro.findMany.mockResolvedValue([SENSOR]);
      const prisma = prismaMock as unknown as { $transaction: jest.Mock; tipoParametro: { count: jest.Mock } };
      prisma.tipoParametro.count = jest.fn().mockResolvedValue(1);
      prisma.$transaction = jest.fn((consultas: Promise<unknown>[]) => Promise.all(consultas));

      const resultado = await service.listar({ pagina: 1, tamanho: 50 }, ADMIN_A);

      expect(resultado).toMatchObject({ total: 1, pagina: 1, tamanho: 50 });
      expect(prismaMock.tipoParametro.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
    });
  });
});
