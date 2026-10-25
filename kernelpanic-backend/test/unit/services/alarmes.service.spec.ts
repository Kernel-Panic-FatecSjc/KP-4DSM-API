import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlarmesService } from '../../../src/alarmes/alarmes.service';
import { StatusAlarme } from '../../../src/generated/prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EstacoesProximasService } from '../../../src/regiao/estacoes-proximas.service';
import { ALARME_COM_RELACOES } from '../../fixtures';
import { ADMIN_B, LICITACAO_A, TECSUS } from '../sessoes';

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
      providers: [AlarmesService, EstacoesProximasService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(AlarmesService);
  });

  describe('atualizarStatus', () => {
    it.each([
      ['ABERTO', 'RECONHECIDO'],
      ['ABERTO', 'RESOLVIDO'],
      ['RECONHECIDO', 'RESOLVIDO'],
    ])('avança de %s para %s', async (atual, novo) => {
      prismaMock.alarme.findUnique.mockResolvedValue({ status: atual, alerta: { licitacaoId: LICITACAO_A } });

      const alarme = await service.atualizarStatus('alarme-1', { status: novo as StatusAlarme }, TECSUS);

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
      prismaMock.alarme.findUnique.mockResolvedValue({ status: atual, alerta: { licitacaoId: LICITACAO_A } });

      await expect(
        service.atualizarStatus('alarme-1', { status: novo as StatusAlarme }, TECSUS),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.alarme.update).not.toHaveBeenCalled();
    });

    it('recusa repetir o status atual', async () => {
      prismaMock.alarme.findUnique.mockResolvedValue({ status: 'RECONHECIDO', alerta: { licitacaoId: LICITACAO_A } });

      await expect(
        service.atualizarStatus('alarme-1', { status: 'RECONHECIDO' as StatusAlarme }, TECSUS),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('recusa mudar o status de alarme de outra licitação', async () => {
      prismaMock.alarme.findUnique.mockResolvedValue({ status: 'ABERTO', alerta: { licitacaoId: LICITACAO_A } });

      await expect(
        service.atualizarStatus('alarme-1', { status: 'RESOLVIDO' as StatusAlarme }, ADMIN_B),
      ).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.alarme.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o alarme não existe', async () => {
      prismaMock.alarme.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizarStatus('sumido', { status: 'RESOLVIDO' as StatusAlarme }, TECSUS),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.alarme.update).not.toHaveBeenCalled();
    });
  });
});
