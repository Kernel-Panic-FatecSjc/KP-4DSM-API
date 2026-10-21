import {
  BadRequestException,
  ConflictException,
  NotFoundException,
} from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { StatusContrato } from '../../../src/generated/prisma/client';
import { ContratosService } from '../../../src/contratos/contratos.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const ORGAO = { id: 'orgao-1', nome: 'Prefeitura', cnpj: null, ativo: true };

interface ContratoDeTeste {
  id: string;
  numero: string;
  objeto: string;
  inicioVigencia: Date;
  fimVigencia: Date;
  status: StatusContrato;
  criadoEm: Date;
  atualizadoEm: Date;
  encerradoEm: Date | null;
  orgaoId: string;
  orgao: typeof ORGAO;
}
const CONTRATO: ContratoDeTeste = {
  id: 'contrato-1',
  numero: 'CTR-2026-001',
  objeto: 'Monitoramento',
  inicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
  fimVigencia: new Date('2026-12-31T00:00:00.000Z'),
  status: StatusContrato.RASCUNHO,
  criadoEm: new Date('2026-01-01T00:00:00.000Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
  encerradoEm: null,
  orgaoId: ORGAO.id,
  orgao: ORGAO,
};
const DTO_CRIAR = {
  numero: 'CTR-2026-001',
  objeto: 'Monitoramento',
  inicioVigencia: '2026-01-01',
  fimVigencia: '2026-12-31',
  orgaoId: ORGAO.id,
};

describe('ContratosService', () => {
  let service: ContratosService;
  const prismaMock = {
    contrato: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    orgaoPublico: { findUnique: jest.fn() },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    prismaMock.contrato.findUnique.mockResolvedValue(null);
    prismaMock.contrato.create.mockImplementation(({ data }) => ({
      ...CONTRATO,
      ...Object.fromEntries(
        Object.entries(data).filter(([, valor]) => valor !== undefined),
      ),
      orgao: ORGAO,
    }));
    prismaMock.contrato.update.mockImplementation(({ data }) => ({
      ...CONTRATO,
      ...Object.fromEntries(
        Object.entries(data).filter(([, valor]) => valor !== undefined),
      ),
    }));
    prismaMock.orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    jest.useFakeTimers().setSystemTime(new Date('2026-01-01T12:00:00.000Z'));

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ContratosService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();

    service = module.get(ContratosService);
  });

  afterEach(() => jest.useRealTimers());

  // buscarPorId e validarNumeroUnico usam o mesmo findUnique: o primeiro é por id, o segundo por número.
  function contratoExistente(sobrescrever: Partial<ContratoDeTeste> = {}) {
    prismaMock.contrato.findUnique.mockImplementation(({ where }) =>
      where.id ? { ...CONTRATO, ...sobrescrever } : null,
    );
  }

  describe('criar', () => {
    it('cria como RASCUNHO por padrão', async () => {
      const contrato = await service.criar(DTO_CRIAR);

      expect(prismaMock.contrato.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            numero: 'CTR-2026-001',
            status: StatusContrato.RASCUNHO,
            orgaoId: ORGAO.id,
          }),
        }),
      );
      expect(contrato.encerradoEm).toBeNull();
    });

    it('aceita fim da vigência igual ao início', async () => {
      await expect(
        service.criar({
          ...DTO_CRIAR,
          inicioVigencia: '2026-05-01',
          fimVigencia: '2026-05-01',
        }),
      ).resolves.toBeDefined();
    });

    it('interpreta data final sem horário como o fim daquele dia', async () => {
      await service.criar({ ...DTO_CRIAR, fimVigencia: '2026-12-31' });
      expect(
        prismaMock.contrato.create.mock.calls[0][0].data.fimVigencia,
      ).toEqual(new Date('2026-12-31T23:59:59.999Z'));
    });

    it('recusa criar ativo com vigência expirada', async () => {
      await expect(
        service.criar({
          ...DTO_CRIAR,
          fimVigencia: '2025-12-31',
          status: StatusContrato.VIGENTE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.contrato.create).not.toHaveBeenCalled();
    });

    it('recusa fim da vigência anterior ao início', async () => {
      await expect(
        service.criar({
          ...DTO_CRIAR,
          inicioVigencia: '2026-05-02',
          fimVigencia: '2026-05-01',
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.contrato.create).not.toHaveBeenCalled();
    });

    it('recusa ativar contrato com vigência já expirada', async () => {
      await expect(
        service.criar({
          ...DTO_CRIAR,
          fimVigencia: '2025-12-31',
          status: StatusContrato.VIGENTE,
        }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.contrato.create).not.toHaveBeenCalled();
    });

    it('recusa número já cadastrado', async () => {
      prismaMock.contrato.findUnique.mockResolvedValue(CONTRATO);

      await expect(service.criar(DTO_CRIAR)).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaMock.contrato.create).not.toHaveBeenCalled();
    });

    it('converte a violação de unicidade do banco (corrida) em 409', async () => {
      prismaMock.contrato.create.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );

      await expect(service.criar(DTO_CRIAR)).rejects.toBeInstanceOf(
        ConflictException,
      );
    });

    it('repassa erros inesperados do banco', async () => {
      const erro = new Error('conexao perdida');
      prismaMock.contrato.create.mockRejectedValue(erro);

      await expect(service.criar(DTO_CRIAR)).rejects.toBe(erro);
    });

    it('recusa órgão inexistente', async () => {
      prismaMock.orgaoPublico.findUnique.mockResolvedValue(null);

      await expect(service.criar(DTO_CRIAR)).rejects.toThrow(
        'Orgao nao encontrado',
      );
    });

    it('recusa órgão inativo', async () => {
      prismaMock.orgaoPublico.findUnique.mockResolvedValue({
        ...ORGAO,
        ativo: false,
      });

      await expect(service.criar(DTO_CRIAR)).rejects.toThrow('Orgao inativo');
    });

    it('permite criar já VIGENTE quando a vigência ainda vale', async () => {
      const contrato = await service.criar({
        ...DTO_CRIAR,
        status: StatusContrato.VIGENTE,
      });

      expect(contrato.status).toBe(StatusContrato.VIGENTE);
    });

    it('recusa criar direto como SUSPENSO (transição inexistente a partir de RASCUNHO)', async () => {
      await expect(
        service.criar({ ...DTO_CRIAR, status: StatusContrato.SUSPENSO }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('registra encerradoEm ao criar já ENCERRADO', async () => {
      const contrato = await service.criar({
        ...DTO_CRIAR,
        status: StatusContrato.ENCERRADO,
      });

      expect(contrato.encerradoEm).toBeInstanceOf(Date);
    });
  });

  describe('buscarPorId', () => {
    it('lança 404 quando não existe', async () => {
      await expect(service.buscarPorId('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('atualizar', () => {
    it('lança 404 quando o contrato não existe', async () => {
      await expect(
        service.atualizar('x', { objeto: 'novo' }),
      ).rejects.toBeInstanceOf(NotFoundException);
    });

    it('edita campos simples sem tocar no status', async () => {
      contratoExistente();

      await service.atualizar(CONTRATO.id, { objeto: 'Novo objeto' });

      expect(prismaMock.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            objeto: 'Novo objeto',
            encerradoEm: undefined,
          }),
        }),
      );
    });

    it('valida a vigência usando o valor já gravado quando só um lado é enviado', async () => {
      contratoExistente();

      await expect(
        service.atualizar(CONTRATO.id, { fimVigencia: '2025-12-31' }),
      ).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.atualizar(CONTRATO.id, { inicioVigencia: '2027-01-01' }),
      ).rejects.toBeInstanceOf(BadRequestException);
    });

    it('recusa reativar contrato suspenso com vigência expirada', async () => {
      contratoExistente({
        status: StatusContrato.SUSPENSO,
        fimVigencia: new Date('2025-12-31T23:59:59.999Z'),
      });

      await expect(
        service.atualizar(CONTRATO.id, { status: StatusContrato.VIGENTE }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.contrato.update).not.toHaveBeenCalled();
    });

    it('recusa trocar para número que já existe', async () => {
      prismaMock.contrato.findUnique.mockImplementation(({ where }) =>
        where.id ? CONTRATO : { ...CONTRATO, id: 'outro' },
      );

      await expect(
        service.atualizar(CONTRATO.id, { numero: 'CTR-OUTRO' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it('não revalida o número quando ele não mudou', async () => {
      prismaMock.contrato.findUnique.mockImplementation(({ where }) =>
        where.id ? CONTRATO : CONTRATO,
      );

      await expect(
        service.atualizar(CONTRATO.id, { numero: CONTRATO.numero }),
      ).resolves.toBeDefined();
    });

    it('recusa mover para órgão inativo', async () => {
      contratoExistente();
      prismaMock.orgaoPublico.findUnique.mockResolvedValue({
        ...ORGAO,
        id: 'orgao-2',
        ativo: false,
      });

      await expect(
        service.atualizar(CONTRATO.id, { orgaoId: 'orgao-2' }),
      ).rejects.toThrow('Orgao inativo');
    });

    it('converte a violação de unicidade do banco (corrida) em 409', async () => {
      contratoExistente();
      prismaMock.contrato.update.mockRejectedValue(
        Object.assign(new Error('unique'), { code: 'P2002' }),
      );

      await expect(
        service.atualizar(CONTRATO.id, { numero: 'CTR-NOVO' }),
      ).rejects.toBeInstanceOf(ConflictException);
    });

    it.each([
      [StatusContrato.RASCUNHO, StatusContrato.VIGENTE],
      [StatusContrato.RASCUNHO, StatusContrato.ENCERRADO],
      [StatusContrato.VIGENTE, StatusContrato.SUSPENSO],
      [StatusContrato.VIGENTE, StatusContrato.ENCERRADO],
      [StatusContrato.SUSPENSO, StatusContrato.VIGENTE],
      [StatusContrato.SUSPENSO, StatusContrato.ENCERRADO],
    ])('permite a transição %s -> %s', async (atual, novo) => {
      contratoExistente({ status: atual });

      await expect(
        service.atualizar(CONTRATO.id, { status: novo }),
      ).resolves.toBeDefined();
    });

    it.each([
      [StatusContrato.RASCUNHO, StatusContrato.SUSPENSO],
      [StatusContrato.VIGENTE, StatusContrato.RASCUNHO],
      [StatusContrato.SUSPENSO, StatusContrato.RASCUNHO],
    ])('recusa a transição %s -> %s', async (atual, novo) => {
      contratoExistente({ status: atual });

      await expect(
        service.atualizar(CONTRATO.id, { status: novo }),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(prismaMock.contrato.update).not.toHaveBeenCalled();
    });

    it('grava encerradoEm ao encerrar por edição', async () => {
      contratoExistente({ status: StatusContrato.VIGENTE });

      await service.atualizar(CONTRATO.id, {
        status: StatusContrato.ENCERRADO,
      });

      expect(prismaMock.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ encerradoEm: expect.any(Date) }),
        }),
      );
    });

    it('não permite editar contrato encerrado', async () => {
      contratoExistente({ status: StatusContrato.ENCERRADO });

      await expect(
        service.atualizar(CONTRATO.id, { objeto: 'tentativa' }),
      ).rejects.toThrow('encerrado');
      expect(prismaMock.contrato.update).not.toHaveBeenCalled();
    });
  });

  describe('encerrar', () => {
    it('lança 404 quando o contrato não existe', async () => {
      await expect(service.encerrar('x')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('encerra sem excluir, gravando status e encerradoEm', async () => {
      contratoExistente({ status: StatusContrato.VIGENTE });

      const contrato = await service.encerrar(CONTRATO.id);

      expect(prismaMock.contrato.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: {
            status: StatusContrato.ENCERRADO,
            encerradoEm: expect.any(Date),
          },
        }),
      );
      expect(contrato.status).toBe(StatusContrato.ENCERRADO);
    });

    it('recusa reencerrar para não sobrescrever o encerradoEm original', async () => {
      contratoExistente({ status: StatusContrato.ENCERRADO });

      await expect(service.encerrar(CONTRATO.id)).rejects.toBeInstanceOf(
        BadRequestException,
      );
      expect(prismaMock.contrato.update).not.toHaveBeenCalled();
    });
  });
});
