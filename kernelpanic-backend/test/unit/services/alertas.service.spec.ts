import { BadRequestException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AlertasService } from '../../../src/alertas/alertas.service';
import { CriarAlertaDto } from '../../../src/alertas/dto/criar-alerta.dto';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { EstacoesProximasService } from '../../../src/regiao/estacoes-proximas.service';
import { ALERTA_COM_RELACOES, NOVO_ALERTA, PARAMETRO_CHUVA } from '../../fixtures';
import { ADMIN_A, ADMIN_B, LICITACAO_A, LICITACAO_B, TECSUS } from '../sessoes';

describe('AlertasService', () => {
  let service: AlertasService;
  const prismaMock = {
    parametro: { findUnique: jest.fn(), findMany: jest.fn() },
    alerta: { create: jest.fn(), findUnique: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    estacao: { findMany: jest.fn() },
    tipoParametro: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [AlertasService, EstacoesProximasService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(AlertasService);
  });

  describe('criar', () => {
    it('persiste a regra com parâmetro, limiar e severidade quando o parâmetro existe', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({ estacao: { licitacaoId: LICITACAO_A } });
      prismaMock.alerta.create.mockResolvedValue(ALERTA_COM_RELACOES);

      const alerta = await service.criar(NOVO_ALERTA as CriarAlertaDto, TECSUS);

      expect(prismaMock.parametro.findUnique).toHaveBeenCalledWith(expect.objectContaining({ where: { id: PARAMETRO_CHUVA } }));
      expect(prismaMock.alerta.create).toHaveBeenCalledWith(
        expect.objectContaining({ data: { ...NOVO_ALERTA, licitacaoId: LICITACAO_A } }),
      );
      expect(alerta).toBe(ALERTA_COM_RELACOES);
    });

    it('recusa criar alerta para parâmetro de outra licitação', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue({ estacao: { licitacaoId: LICITACAO_A } });

      await expect(service.criar(NOVO_ALERTA as CriarAlertaDto, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.alerta.create).not.toHaveBeenCalled();
    });

    it('lança BadRequestException quando o parâmetro monitorado não existe', async () => {
      prismaMock.parametro.findUnique.mockResolvedValue(null);

      await expect(service.criar(NOVO_ALERTA as CriarAlertaDto, TECSUS)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.alerta.create).not.toHaveBeenCalled();
    });
  });

  describe('atualizar', () => {
    it('recusa editar alerta de outra licitação', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(ALERTA_COM_RELACOES);

      await expect(service.atualizar(ALERTA_COM_RELACOES.id, { valorLimite: 1 }, ADMIN_B)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });

    it('lança NotFoundException quando o alerta não existe', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('inexistente', { valorLimite: 40 }, TECSUS)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });

    it('lança BadRequestException ao trocar para um parâmetro monitorado inexistente', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue({ ...ALERTA_COM_RELACOES, parametroId: 'outro' });
      prismaMock.parametro.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizar(ALERTA_COM_RELACOES.id, { parametroId: PARAMETRO_CHUVA }, TECSUS),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });

    it('não consulta o parâmetro quando ele não é alterado', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(ALERTA_COM_RELACOES);
      prismaMock.alerta.update.mockResolvedValue({ ...ALERTA_COM_RELACOES, valorLimite: 40 });

      await service.atualizar(ALERTA_COM_RELACOES.id, { valorLimite: 40 }, TECSUS);

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

      const alerta = await service.inativar(ALERTA_COM_RELACOES.id, TECSUS);

      expect(prismaMock.alerta.update).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: ALERTA_COM_RELACOES.id }, data: { ativo: false } }),
      );
      expect(alerta.ativo).toBe(false);
    });

    it('lança NotFoundException quando o alerta não existe', async () => {
      prismaMock.alerta.findUnique.mockResolvedValue(null);

      await expect(service.inativar('sumido', TECSUS)).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.alerta.update).not.toHaveBeenCalled();
    });
  });

  describe('listar', () => {
    beforeEach(() => {
      prismaMock.alerta.findMany.mockResolvedValue([ALERTA_COM_RELACOES]);
      prismaMock.alerta.count.mockResolvedValue(1);
    });

    it('o visitante vê os alertas de qualquer licitação, paginados', async () => {
      const resultado = await service.listar({ pagina: 2, tamanho: 10 }, undefined, null);

      expect(resultado).toMatchObject({ total: 1, pagina: 2, tamanho: 10 });
      expect(prismaMock.alerta.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ skip: 10, take: 10, where: expect.objectContaining({ licitacaoId: undefined }) }),
      );
    });

    it('o admin da licitação vê só os alertas da licitação dele', async () => {
      await service.listar({}, undefined, ADMIN_A);

      expect(prismaMock.alerta.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
    });

    it('nega ao admin da licitação filtrar a licitação de outro', async () => {
      await expect(service.listar({ licitacaoId: 'outra-licitacao' }, undefined, ADMIN_A)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.alerta.findMany).not.toHaveBeenCalled();
    });
  });

  describe('buscarOpcoesFiltro', () => {
    beforeEach(() => {
      prismaMock.estacao.findMany.mockResolvedValue([{ id: 'e1', nome: 'Centro' }]);
      prismaMock.tipoParametro.findMany.mockResolvedValue([{ id: 't1', nome: 'Temperatura' }]);
      prismaMock.parametro.findMany.mockResolvedValue([
        {
          id: 'p1',
          estacao: { id: 'e1', nome: 'Centro' },
          tipoParametro: { nome: 'Temperatura', unidade: '°C' },
        },
      ]);
    });

    it('devolve estações, tipos, parâmetros por estação e as severidades aceitas', async () => {
      const opcoes = await service.buscarOpcoesFiltro(undefined, null);

      expect(opcoes.estacoes).toEqual([{ id: 'e1', nome: 'Centro' }]);
      expect(opcoes.tiposParametro).toEqual([{ id: 't1', nome: 'Temperatura' }]);
      expect(opcoes.parametros).toEqual([
        { id: 'p1', nome: 'Temperatura', unidade: '°C', estacaoId: 'e1', estacaoNome: 'Centro' },
      ]);
      expect(opcoes.severidades).toEqual(['ATENCAO', 'ALERTA', 'EMERGENCIA']);
    });

    it('prende o admin da licitação às opções da licitação dele', async () => {
      await service.buscarOpcoesFiltro(undefined, ADMIN_A);

      expect(prismaMock.estacao.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
      expect(prismaMock.tipoParametro.findMany.mock.calls[0][0].where.licitacaoId).toBe(LICITACAO_A);
      expect(prismaMock.parametro.findMany.mock.calls[0][0].where.estacao.licitacaoId).toBe(LICITACAO_A);
    });

    it('nega ao admin da licitação pedir as opções de outra licitação', async () => {
      await expect(service.buscarOpcoesFiltro(undefined, ADMIN_A, LICITACAO_B)).rejects.toBeInstanceOf(
        ForbiddenException,
      );
      expect(prismaMock.estacao.findMany).not.toHaveBeenCalled();
    });
  });
});
