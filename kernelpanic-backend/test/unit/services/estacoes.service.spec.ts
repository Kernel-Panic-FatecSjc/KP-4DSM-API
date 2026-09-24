import { BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AtualizarEstacaoDto } from '../../../src/estacoes/dto/atualizar-estacao.dto';
import { EstacoesService } from '../../../src/estacoes/estacoes.service';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TIPO_CHUVA, TIPO_TEMPERATURA } from '../../fixtures';

const ESTACAO = {
  id: 'estacao-1',
  vid: 'ESP32-00001',
  parametros: [{ id: 'parametro-chuva', tipoParametroId: TIPO_CHUVA }],
};

describe('EstacoesService', () => {
  let service: EstacoesService;
  const prismaMock = {
    estacao: { findUnique: jest.fn(), update: jest.fn() },
    tipoParametro: { findMany: jest.fn() },
    medida: { findFirst: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.estacao.update.mockImplementation(({ data }) => ({ ...ESTACAO, ...data }));
    prismaMock.medida.findFirst.mockResolvedValue(null);

    const module: TestingModule = await Test.createTestingModule({
      providers: [EstacoesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(EstacoesService);
  });

  describe('atualizar', () => {
    it('altera apenas os campos enviados', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);

      await service.atualizar('estacao-1', { nome: 'Estação Norte' });

      expect(prismaMock.estacao.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'estacao-1' },
          data: expect.objectContaining({ nome: 'Estação Norte', endereco: undefined }),
        }),
      );
    });

    it('lança NotFoundException quando a estação não existe', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('sumida', { nome: 'x' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.estacao.update).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando o novo vid já pertence a outra estação', async () => {
      prismaMock.estacao.findUnique
        .mockResolvedValueOnce(ESTACAO)
        .mockResolvedValueOnce({ id: 'estacao-2', vid: 'ESP32-00002' });

      await expect(
        service.atualizar('estacao-1', { vid: 'ESP32-00002' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.estacao.update).not.toHaveBeenCalled();
    });

    it('mantém o vid atual sem checar conflito', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);

      await service.atualizar('estacao-1', { vid: ESTACAO.vid });

      expect(prismaMock.estacao.findUnique).toHaveBeenCalledTimes(1);
    });

    describe('mudança de sensores', () => {
      const comSensores = (tipoParametroIds: string[]): AtualizarEstacaoDto => ({
        tipoParametroIds,
      });

      beforeEach(() => {
        prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);
        prismaMock.tipoParametro.findMany.mockImplementation(({ where }) =>
          where.id.in.map((id: string) => ({ id })),
        );
      });

      it('adiciona o sensor novo e preserva o que já estava', async () => {
        await service.atualizar('estacao-1', comSensores([TIPO_CHUVA, TIPO_TEMPERATURA]));

        const { data } = prismaMock.estacao.update.mock.calls[0][0];
        expect(data.parametros).toEqual({
          deleteMany: undefined,
          create: [{ tipoParametroId: TIPO_TEMPERATURA }],
        });
      });

      it('remove o sensor que ainda não coletou medidas', async () => {
        await service.atualizar('estacao-1', comSensores([TIPO_TEMPERATURA]));

        const { data } = prismaMock.estacao.update.mock.calls[0][0];
        expect(data.parametros).toEqual({
          deleteMany: { id: { in: ['parametro-chuva'] } },
          create: [{ tipoParametroId: TIPO_TEMPERATURA }],
        });
      });

      it('recusa remover sensor que já possui medidas, para não apagar a série', async () => {
        prismaMock.medida.findFirst.mockResolvedValue({ parametroId: 'parametro-chuva' });

        await expect(
          service.atualizar('estacao-1', comSensores([TIPO_TEMPERATURA])),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prismaMock.estacao.update).not.toHaveBeenCalled();
      });

      it('recusa sensor repetido e sensor inexistente', async () => {
        await expect(
          service.atualizar('estacao-1', comSensores([TIPO_CHUVA, TIPO_CHUVA])),
        ).rejects.toBeInstanceOf(BadRequestException);

        prismaMock.tipoParametro.findMany.mockResolvedValue([]);
        await expect(
          service.atualizar('estacao-1', comSensores([TIPO_TEMPERATURA])),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });
  });

  describe('inativar', () => {
    it('marca a estação como INATIVA em vez de apagar', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);

      await service.inativar('estacao-1');

      expect(prismaMock.estacao.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'estacao-1' },
          data: { statusOperacional: 'INATIVA' },
        }),
      );
    });

    it('lança NotFoundException quando a estação não existe', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(service.inativar('sumida')).rejects.toBeInstanceOf(NotFoundException);
    });
  });
});
