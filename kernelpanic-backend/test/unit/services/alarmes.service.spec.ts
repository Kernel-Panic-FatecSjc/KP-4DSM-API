import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlarmesService } from '../../../src/alarmes/alarmes.service';
import { StatusAlarme } from '../../../src/generated/prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { ALARME_COM_RELACOES } from '../../fixtures';

describe('AlarmesService', () => {
  let service: AlarmesService;
  const prismaMock = { alarme: { findUnique: jest.fn(), update: jest.fn() } };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.alarme.update.mockImplementation(({ data }) => ({
      ...ALARME_COM_RELACOES,
      ...data,
    }));

    const module: TestingModule = await Test.createTestingModule({
      providers: [AlarmesService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(AlarmesService);
  });

  describe('atualizarStatus', () => {
    it.each([
      ['ABERTO', 'RECONHECIDO'],
      ['ABERTO', 'RESOLVIDO'],
      ['RECONHECIDO', 'RESOLVIDO'],
    ])('avança de %s para %s', async (atual, novo) => {
      prismaMock.alarme.findUnique.mockResolvedValue({ status: atual });

      const alarme = await service.atualizarStatus('alarme-1', { status: novo as StatusAlarme });

      expect(prismaMock.alarme.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'alarme-1' }, data: { status: novo } }),
      );
      expect(alarme.status).toBe(novo);
    });

    it.each([
      ['RECONHECIDO', 'ABERTO'],
      ['RESOLVIDO', 'RECONHECIDO'],
      ['RESOLVIDO', 'ABERTO'],
    ])('recusa voltar de %s para %s', async (atual, novo) => {
      prismaMock.alarme.findUnique.mockResolvedValue({ status: atual });

      await expect(
        service.atualizarStatus('alarme-1', { status: novo as StatusAlarme }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.alarme.update).not.toHaveBeenCalled();
    });

    it('recusa repetir o status atual', async () => {
      prismaMock.alarme.findUnique.mockResolvedValue({ status: 'RECONHECIDO' });

      await expect(
        service.atualizarStatus('alarme-1', { status: 'RECONHECIDO' as StatusAlarme }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('lança NotFoundException quando o alarme não existe', async () => {
      prismaMock.alarme.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizarStatus('sumido', { status: 'RESOLVIDO' as StatusAlarme }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.alarme.update).not.toHaveBeenCalled();
    });
  });
});
