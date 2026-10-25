import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { AtualizarEstacaoDto } from '../../../src/estacoes/dto/atualizar-estacao.dto';
import { EstacoesService } from '../../../src/estacoes/estacoes.service';
import { BrokerService } from '../../../src/broker/broker.service';
import { chaveIngestaoConfere } from '../../../src/estacoes/chave-ingestao';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { TIPO_CHUVA, TIPO_TEMPERATURA } from '../../fixtures';
import { ADMIN_A, ADMIN_B, LICITACAO_A, LICITACAO_B, TECSUS } from '../sessoes';

const ESTACAO = {
  id: 'estacao-1',
  vid: 'ESP32-00001',
  licitacaoId: LICITACAO_A,
  parametros: [{ id: 'parametro-chuva', tipoParametroId: TIPO_CHUVA }],
};

describe('EstacoesService', () => {
  let service: EstacoesService;
  const prismaMock = {
    estacao: { findUnique: jest.fn(), update: jest.fn(), create: jest.fn() },
    tipoParametro: { findMany: jest.fn() },
    medida: { findFirst: jest.fn() },
    licitacao: { findUnique: jest.fn() },
    // A transação recebe o próprio mock: o que importa é a ordem banco → broker.
    $transaction: jest.fn(),
  };
  const brokerMock = { cadastrarEstacao: jest.fn(), removerEstacao: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.estacao.update.mockImplementation(({ data }) => ({
      ...ESTACAO,
      ...data,
    }));
    prismaMock.medida.findFirst.mockResolvedValue(null);
    prismaMock.licitacao.findUnique.mockResolvedValue({ status: 'VIGENTE' });
    prismaMock.$transaction.mockImplementation((operacao: (tx: typeof prismaMock) => unknown) => operacao(prismaMock));
    brokerMock.cadastrarEstacao.mockResolvedValue(undefined);
    brokerMock.removerEstacao.mockResolvedValue(undefined);

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        EstacoesService,
        { provide: PrismaService, useValue: prismaMock },
        { provide: BrokerService, useValue: brokerMock },
      ],
    }).compile();

    service = module.get(EstacoesService);
  });

  describe('atualizar', () => {
    it('altera apenas os campos enviados', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);

      await service.atualizar('estacao-1', { nome: 'Estação Norte' }, TECSUS);

      expect(prismaMock.estacao.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'estacao-1' },
          data: expect.objectContaining({
            nome: 'Estação Norte',
            endereco: undefined,
          }),
        }),
      );
    });

    it('lança NotFoundException quando a estação não existe', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(
        service.atualizar('sumida', { nome: 'x' }, TECSUS),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.estacao.update).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando o novo vid já pertence a outra estação', async () => {
      prismaMock.estacao.findUnique
        .mockResolvedValueOnce(ESTACAO)
        .mockResolvedValueOnce({ id: 'estacao-2', vid: 'ESP32-00002' });

      await expect(
        service.atualizar('estacao-1', { vid: 'ESP32-00002' }, TECSUS),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.estacao.update).not.toHaveBeenCalled();
    });

    it('mantém o vid atual sem checar conflito', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);

      await service.atualizar('estacao-1', { vid: ESTACAO.vid }, TECSUS);

      expect(prismaMock.estacao.findUnique).toHaveBeenCalledTimes(1);
    });

    describe('mudança de sensores', () => {
      const comSensores = (
        tipoParametroIds: string[],
      ): AtualizarEstacaoDto => ({
        tipoParametroIds,
      });

      beforeEach(() => {
        prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);
        prismaMock.tipoParametro.findMany.mockImplementation(({ where }) =>
          where.id.in.map((id: string) => ({ id, licitacaoId: LICITACAO_A })),
        );
      });

      it('adiciona o sensor novo e preserva o que já estava', async () => {
        await service.atualizar('estacao-1', comSensores([TIPO_CHUVA, TIPO_TEMPERATURA]), TECSUS);

        const { data } = prismaMock.estacao.update.mock.calls[0][0];
        expect(data.parametros).toEqual({
          deleteMany: undefined,
          create: [{ tipoParametroId: TIPO_TEMPERATURA }],
        });
      });

      it('remove o sensor que ainda não coletou medidas', async () => {
        await service.atualizar('estacao-1', comSensores([TIPO_TEMPERATURA]), TECSUS);

        const { data } = prismaMock.estacao.update.mock.calls[0][0];
        expect(data.parametros).toEqual({
          deleteMany: { id: { in: ['parametro-chuva'] } },
          create: [{ tipoParametroId: TIPO_TEMPERATURA }],
        });
      });

      it('recusa remover sensor que já possui medidas, para não apagar a série', async () => {
        prismaMock.medida.findFirst.mockResolvedValue({
          parametroId: 'parametro-chuva',
        });

        await expect(
          service.atualizar('estacao-1', comSensores([TIPO_TEMPERATURA]), TECSUS),
        ).rejects.toBeInstanceOf(ConflictException);
        expect(prismaMock.estacao.update).not.toHaveBeenCalled();
      });

      it('recusa sensor repetido e sensor inexistente', async () => {
        await expect(
          service.atualizar('estacao-1', comSensores([TIPO_CHUVA, TIPO_CHUVA]), TECSUS),
        ).rejects.toBeInstanceOf(BadRequestException);

        prismaMock.tipoParametro.findMany.mockResolvedValue([]);
        await expect(
          service.atualizar('estacao-1', comSensores([TIPO_TEMPERATURA]), TECSUS),
        ).rejects.toBeInstanceOf(BadRequestException);
      });
    });
  });

  describe('inativar', () => {
    it('marca a estação como INATIVA em vez de apagar', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(ESTACAO);

      await service.inativar('estacao-1', TECSUS);

      expect(prismaMock.estacao.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'estacao-1' },
          data: { statusOperacional: 'INATIVA' },
        }),
      );
    });

    it('lança NotFoundException quando a estação não existe', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(service.inativar('sumida', TECSUS)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('criar', () => {
    const NOVA = {
      nome: 'Estação Sul',
      endereco: 'Rua B',
      vid: '11:22:33:44:55:66',
      latitude: -23.2,
      longitude: -45.9,
    };

    beforeEach(() => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);
      prismaMock.estacao.create = jest
        .fn()
        .mockImplementation(({ data }) => ({ id: 'nova', ...data }));
      prismaMock.tipoParametro.findMany.mockResolvedValue([]);
    });

    it('cadastra sem sensor nenhum, para associá-los depois por PATCH', async () => {
      await service.criar({ ...NOVA, licitacaoId: LICITACAO_A }, TECSUS);

      const { data } = prismaMock.estacao.create.mock.calls[0][0];
      expect(data.parametros).toEqual({ create: [] });
    });

    it('cadastra com lista de sensores vazia', async () => {
      await service.criar({ ...NOVA, licitacaoId: LICITACAO_A, tipoParametroIds: [] }, TECSUS);

      const { data } = prismaMock.estacao.create.mock.calls[0][0];
      expect(data.parametros).toEqual({ create: [] });
    });

    it('gera a chave de ingestão, guarda só o hash e devolve a chave', async () => {
      const { chaveIngestao } = await service.criar({ ...NOVA, licitacaoId: LICITACAO_A }, TECSUS);

      const { data } = prismaMock.estacao.create.mock.calls[0][0];
      expect(data.chaveIngestaoHash).not.toBe(chaveIngestao);
      expect(chaveIngestaoConfere(chaveIngestao, data.chaveIngestaoHash)).toBe(
        true,
      );
    });

    it('continua recusando sensor inexistente quando algum é informado', async () => {
      prismaMock.tipoParametro.findMany.mockResolvedValue([]);

      await expect(
        service.criar({ ...NOVA, licitacaoId: LICITACAO_A, tipoParametroIds: [TIPO_CHUVA] }, TECSUS),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.estacao.create).not.toHaveBeenCalled();
    });
  });

  describe('regenerarChaveIngestao', () => {
    it('troca o hash guardado e devolve a chave nova', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue({ ...ESTACAO, parametros: [], licitacao: { id: LICITACAO_A } });

      const chave = await service.regenerarChaveIngestao(ESTACAO.id, TECSUS);

      const { where, data } = prismaMock.estacao.update.mock.calls[0][0];
      expect(where).toEqual({ id: ESTACAO.id });
      expect(chaveIngestaoConfere(chave, data.chaveIngestaoHash)).toBe(true);
    });

    it('lança NotFoundException quando a estação não existe', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(
        service.regenerarChaveIngestao('sumida', TECSUS),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.estacao.update).not.toHaveBeenCalled();
    });
  });

  describe('escopo de licitação e broker', () => {
    const NOVA = { nome: 'Estação Sul', endereco: 'Rua B', vid: '11:22:33:44:55:66', latitude: -23.2, longitude: -45.9 };

    beforeEach(() => {
      prismaMock.estacao.create = jest.fn().mockImplementation(({ data }) => ({ id: 'nova', ...data }));
      prismaMock.tipoParametro.findMany.mockResolvedValue([]);
    });

    it('cadastra no broker a estação nova com a mesma chave devolvida', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      const { chaveIngestao } = await service.criar({ ...NOVA, licitacaoId: LICITACAO_A }, TECSUS);

      expect(brokerMock.cadastrarEstacao).toHaveBeenCalledWith(NOVA.vid, chaveIngestao);
    });

    it('não grava a estação se o broker recusar (o erro desfaz a transação)', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);
      brokerMock.cadastrarEstacao.mockRejectedValue(new ServiceUnavailableException('broker fora'));

      await expect(service.criar({ ...NOVA, licitacaoId: LICITACAO_A }, TECSUS)).rejects.toBeInstanceOf(
        ServiceUnavailableException,
      );
    });

    it('a Tecsus precisa informar a licitação; o admin da licitação usa a dele', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);

      await expect(service.criar(NOVA, TECSUS)).rejects.toBeInstanceOf(BadRequestException);

      await service.criar(NOVA, ADMIN_A);
      expect(prismaMock.estacao.create.mock.calls[0][0].data.licitacaoId).toBe(LICITACAO_A);
    });

    it('recusa estação em licitação encerrada', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);
      prismaMock.licitacao.findUnique.mockResolvedValue({ status: 'ENCERRADA' });

      await expect(service.criar({ ...NOVA, licitacaoId: LICITACAO_A }, TECSUS)).rejects.toBeInstanceOf(
        BadRequestException,
      );
    });

    it('recusa sensores de outra licitação', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue(null);
      prismaMock.tipoParametro.findMany.mockResolvedValue([{ id: TIPO_CHUVA, licitacaoId: LICITACAO_B }]);

      await expect(
        service.criar({ ...NOVA, licitacaoId: LICITACAO_A, tipoParametroIds: [TIPO_CHUVA] }, TECSUS),
      ).rejects.toThrow('mesma licitação');
    });

    it('nega editar, inativar ou trocar a chave de estação de outra licitação', async () => {
      prismaMock.estacao.findUnique.mockResolvedValue({ ...ESTACAO, parametros: [] });

      await expect(service.atualizar(ESTACAO.id, { nome: 'x' }, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.inativar(ESTACAO.id, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.regenerarChaveIngestao(ESTACAO.id, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
      expect(prismaMock.estacao.update).not.toHaveBeenCalled();
    });

    it('com vid novo, apaga a chave e tira o vid antigo do broker', async () => {
      prismaMock.estacao.findUnique.mockResolvedValueOnce(ESTACAO).mockResolvedValueOnce(null);

      await service.atualizar(ESTACAO.id, { vid: 'AA:BB:CC:DD:EE:FF' }, ADMIN_A);

      expect(prismaMock.estacao.update.mock.calls[0][0].data.chaveIngestaoHash).toBeNull();
      expect(brokerMock.removerEstacao).toHaveBeenCalledWith(ESTACAO.vid);
    });
  });
});
