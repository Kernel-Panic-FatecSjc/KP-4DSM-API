import { ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlarmesService } from '../../../src/alarmes/alarmes.service';
import { StatusAlarme } from '../../../src/generated/prisma/client';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EstacoesProximasService } from '../../../src/regiao/estacoes-proximas.service';
import { ALARME_COM_RELACOES } from '../../fixtures';
import { ADMIN_A, ADMIN_B, LICITACAO_A, LICITACAO_B, TECSUS } from '../sessoes';

describe('AlarmesService', () => {
  let service: AlarmesService;
  const prismaMock = {
    alarme: { findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    estacao: { findMany: jest.fn() },
    tipoParametro: { findMany: jest.fn() },
  };

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
        expect.objectContaining({ where: { id: 'alarme-1' }, data: expect.objectContaining({ status: novo }) }),
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

  describe('listarHistorico', () => {
    beforeEach(() => {
      prismaMock.alarme.findMany.mockResolvedValue([ALARME_COM_RELACOES]);
      prismaMock.alarme.count.mockResolvedValue(1);
    });

    it('o visitante vê o histórico de qualquer licitação, paginado', async () => {
      const resultado = await service.listarHistorico({ pagina: 3, tamanho: 20 }, undefined, null);

      expect(resultado).toMatchObject({ total: 1, pagina: 3, tamanho: 20 });
      expect(prismaMock.alarme.findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 40, take: 20 }));
      expect(prismaMock.alarme.findMany.mock.calls[0][0].where.alerta.licitacaoId).toBeUndefined();
    });

    it('o admin da licitação vê só o histórico da licitação dele', async () => {
      await service.listarHistorico({}, undefined, ADMIN_A);

      expect(prismaMock.alarme.findMany.mock.calls[0][0].where.alerta.licitacaoId).toBe(LICITACAO_A);
    });

    it('nega ao admin da licitação filtrar a licitação de outro', async () => {
      await expect(service.listarHistorico({ licitacaoId: LICITACAO_B }, undefined, ADMIN_A)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.alarme.findMany).not.toHaveBeenCalled();
    });

    it('aplica status e período ao filtro', async () => {
      await service.listarHistorico(
        { status: 'ABERTO' as StatusAlarme, de: '2026-01-01T00:00:00.000Z', ate: '2026-01-02T00:00:00.000Z' },
        undefined,
        TECSUS,
      );

      expect(prismaMock.alarme.findMany.mock.calls[0][0].where).toMatchObject({
        status: 'ABERTO',
        disparadoEm: { gte: new Date('2026-01-01T00:00:00.000Z'), lte: new Date('2026-01-02T00:00:00.000Z') },
      });
    });
  });

  describe('buscarRecentes', () => {
    it('busca os alarmes disparados desde o instante informado, com o limite padrão de 200', async () => {
      prismaMock.alarme.findMany.mockResolvedValue([ALARME_COM_RELACOES]);
      const desde = new Date('2026-01-01T00:00:00.000Z');

      const resultado = await service.buscarRecentes(desde);

      expect(resultado).toHaveLength(1);
      expect(prismaMock.alarme.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ where: { disparadoEm: { gte: desde } }, take: 200 }),
      );
    });
  });

  describe('buscarOpcoesFiltro', () => {
    beforeEach(() => {
      prismaMock.estacao.findMany.mockResolvedValue([{ id: 'e1', nome: 'Centro' }]);
      prismaMock.tipoParametro.findMany.mockResolvedValue([{ id: 't1', nome: 'Temperatura' }]);
    });

    it('devolve as estações e os tipos de parâmetro', async () => {
      const opcoes = await service.buscarOpcoesFiltro(undefined, null);

      expect(opcoes).toMatchObject({
        estacoes: [{ id: 'e1', nome: 'Centro' }],
        tiposParametro: [{ id: 't1', nome: 'Temperatura' }],
      });
    });

    it('prende o admin da licitação às opções da licitação dele', async () => {
      await service.buscarOpcoesFiltro(undefined, ADMIN_A);

      expect(prismaMock.estacao.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
      expect(prismaMock.tipoParametro.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
    });

    it('nega ao admin da licitação pedir as opções de outra licitação', async () => {
      await expect(service.buscarOpcoesFiltro(undefined, ADMIN_A, LICITACAO_B)).rejects.toBeInstanceOf(ForbiddenException);
    });
  });
});
