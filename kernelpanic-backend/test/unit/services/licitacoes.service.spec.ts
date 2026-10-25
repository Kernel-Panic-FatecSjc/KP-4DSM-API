import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { LicitacoesService } from '../../../src/licitacoes/licitacoes.service';
import type { CriarLicitacaoDto } from '../../../src/licitacoes/dto/criar-licitacao.dto';
import { ADMIN_A, ADMIN_B, LICITACAO_A, TECSUS } from '../sessoes';

const NOVA: CriarLicitacaoDto = {
  codigoIdentificador: 'PMSJC-2026',
  numeroProcesso: '0123/2026',
  modalidade: 'PREGAO',
  objeto: 'Monitoramento',
  numeroContrato: 'CTR-1',
  inicioVigencia: '2026-01-01',
  fimVigencia: '2099-12-31',
  orgaoNome: 'Prefeitura',
  orgaoCnpj: '11.222.333/0001-81',
  orgaoEsfera: 'MUNICIPAL',
  orgaoMunicipio: 'São José dos Campos',
  orgaoUf: 'SP',
};

const licitacao = (status: string) => ({ id: LICITACAO_A, status, inicioVigencia: new Date('2026-01-01'), fimVigencia: new Date('2099-12-31') });

function criarPrismaMock() {
  const prisma = {
    licitacao: { findUnique: jest.fn(), create: jest.fn(), update: jest.fn(), findMany: jest.fn(), count: jest.fn() },
    estacao: { findMany: jest.fn(), updateMany: jest.fn() },
    alerta: { updateMany: jest.fn() },
    tipoParametro: { findMany: jest.fn() },
    parametro: { update: jest.fn() },
    $transaction: jest.fn(),
  };
  prisma.$transaction.mockImplementation((operacao: unknown) =>
    typeof operacao === 'function' ? operacao(prisma) : Promise.all(operacao as Promise<unknown>[]),
  );
  prisma.licitacao.create.mockImplementation(({ data }) => ({ id: 'nova', ...data }));
  prisma.licitacao.update.mockImplementation(({ data }) => ({ id: LICITACAO_A, ...data }));
  prisma.estacao.updateMany.mockResolvedValue({ count: 2 });
  prisma.alerta.updateMany.mockResolvedValue({ count: 3 });
  return prisma;
}

describe('LicitacoesService', () => {
  let prisma: ReturnType<typeof criarPrismaMock>;
  let service: LicitacoesService;

  beforeEach(() => {
    prisma = criarPrismaMock();
    service = new LicitacoesService(prisma as never);
  });

  describe('criar', () => {
    it('nasce como rascunho, com CNPJ só com dígitos e vigência até o fim do dia', async () => {
      const criada = await service.criar(NOVA);

      expect(criada).toMatchObject({ status: 'RASCUNHO', orgaoCnpj: '11222333000181' });
      expect(prisma.licitacao.create.mock.calls[0][0].data.fimVigencia).toEqual(new Date('2099-12-31T23:59:59.999Z'));
    });

    it('recusa vigência invertida, vigente vencida e nascer encerrada', async () => {
      await expect(service.criar({ ...NOVA, fimVigencia: '2025-01-01' })).rejects.toBeInstanceOf(BadRequestException);
      await expect(
        service.criar({ ...NOVA, inicioVigencia: '2020-01-01', fimVigencia: '2020-12-31', status: 'VIGENTE' }),
      ).rejects.toThrow('expirada');
      await expect(service.criar({ ...NOVA, status: 'ENCERRADA' })).rejects.toBeInstanceOf(BadRequestException);
    });

    it('converte a violação de unicidade em 409 com o campo certo', async () => {
      prisma.licitacao.create.mockRejectedValue({ code: 'P2002', meta: { target: ['numeroContrato'] } });

      await expect(service.criar(NOVA)).rejects.toThrow(new ConflictException('Já existe uma licitação com este número de contrato'));
    });
  });

  describe('atualizar', () => {
    it('segue as transições do contrato: suspender e reativar', async () => {
      prisma.licitacao.findUnique.mockResolvedValue(licitacao('VIGENTE'));
      await expect(service.atualizar(LICITACAO_A, { status: 'SUSPENSA' })).resolves.toMatchObject({ status: 'SUSPENSA' });

      prisma.licitacao.findUnique.mockResolvedValue(licitacao('SUSPENSA'));
      await expect(service.atualizar(LICITACAO_A, { status: 'VIGENTE' })).resolves.toMatchObject({ status: 'VIGENTE' });
    });

    it('recusa voltar para rascunho e encerrar pelo PATCH comum', async () => {
      prisma.licitacao.findUnique.mockResolvedValue(licitacao('VIGENTE'));

      await expect(service.atualizar(LICITACAO_A, { status: 'RASCUNHO' })).rejects.toThrow('Transição');
      await expect(service.atualizar(LICITACAO_A, { status: 'ENCERRADA' })).rejects.toThrow('/encerrar');
    });

    it('licitação encerrada é imutável', async () => {
      prisma.licitacao.findUnique.mockResolvedValue(licitacao('ENCERRADA'));

      await expect(service.atualizar(LICITACAO_A, { objeto: 'x' })).rejects.toBeInstanceOf(BadRequestException);
      expect(prisma.licitacao.update).not.toHaveBeenCalled();
    });
  });

  describe('encerrar', () => {
    it('encerra, inativa as estações e os alertas da licitação, na mesma transação', async () => {
      prisma.licitacao.findUnique.mockResolvedValue(licitacao('VIGENTE'));

      const resultado = await service.encerrar(LICITACAO_A);

      expect(resultado).toMatchObject({ estacoesInativadas: 2, alertasInativados: 3, licitacao: { status: 'ENCERRADA' } });
      expect(prisma.licitacao.update.mock.calls[0][0].data.encerradaEm).toBeInstanceOf(Date);
      expect(prisma.estacao.updateMany).toHaveBeenCalledWith({
        where: { licitacaoId: LICITACAO_A, statusOperacional: 'ATIVA' },
        data: { statusOperacional: 'INATIVA' },
      });
      expect(prisma.alerta.updateMany).toHaveBeenCalledWith({
        where: { licitacaoId: LICITACAO_A, ativo: true },
        data: { ativo: false },
      });
      expect(prisma.$transaction).toHaveBeenCalledTimes(1);
    });

    it('não reencerra (preserva o encerradaEm original)', async () => {
      prisma.licitacao.findUnique.mockResolvedValue(licitacao('ENCERRADA'));

      await expect(service.encerrar(LICITACAO_A)).rejects.toBeInstanceOf(BadRequestException);
    });
  });

  describe('buscarPorId', () => {
    it('nega a licitação de outro cliente e acha a própria', async () => {
      prisma.licitacao.findUnique.mockResolvedValue(licitacao('VIGENTE'));

      await expect(service.buscarPorId(LICITACAO_A, ADMIN_B)).rejects.toBeInstanceOf(ForbiddenException);
      await expect(service.buscarPorId(LICITACAO_A, ADMIN_A)).resolves.toMatchObject({ id: LICITACAO_A });
      await expect(service.buscarPorId(LICITACAO_A, TECSUS)).resolves.toMatchObject({ id: LICITACAO_A });
    });

    it('lança NotFoundException para licitação inexistente', async () => {
      prisma.licitacao.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId('x')).rejects.toBeInstanceOf(NotFoundException);
    });
  });

  describe('listar', () => {
    it('o usuário de licitação recebe só a dele', async () => {
      prisma.licitacao.findMany.mockResolvedValue([]);
      prisma.licitacao.count.mockResolvedValue(0);

      await service.listar({ pagina: 1, tamanho: 10 }, ADMIN_A);
      await service.listar({ pagina: 1, tamanho: 10 }, TECSUS);

      expect(prisma.licitacao.findMany.mock.calls[0][0].where.id).toBe(LICITACAO_A);
      expect(prisma.licitacao.findMany.mock.calls[1][0].where.id).toBeUndefined();
    });
  });

  describe('vincularEstacoes (transferência)', () => {
    const estacaoDaOrigem = {
      id: 'estacao-1',
      nome: 'Estação 1',
      licitacaoId: 'licitacao-origem',
      parametros: [{ id: 'parametro-1', tipoParametro: { nome: 'Chuva' } }],
    };

    beforeEach(() => {
      prisma.licitacao.findUnique.mockResolvedValue(licitacao('VIGENTE'));
      prisma.estacao.findMany.mockResolvedValue([estacaoDaOrigem]);
    });

    it('troca a licitação da estação, aponta os sensores para os tipos de mesmo nome e inativa os alertas da origem', async () => {
      prisma.tipoParametro.findMany.mockResolvedValue([{ id: 'tipo-destino', nome: 'chuva' }]);
      prisma.alerta.updateMany.mockResolvedValue({ count: 1 });

      const resultado = await service.vincularEstacoes(LICITACAO_A, ['estacao-1']);

      expect(resultado).toEqual({ estacoesVinculadas: 1, alertasInativados: 1 });
      expect(prisma.estacao.updateMany).toHaveBeenCalledWith({ where: { id: { in: ['estacao-1'] } }, data: { licitacaoId: LICITACAO_A } });
      expect(prisma.parametro.update).toHaveBeenCalledWith({ where: { id: 'parametro-1' }, data: { tipoParametroId: 'tipo-destino' } });
      expect(prisma.alerta.updateMany.mock.calls[0][0].where).toMatchObject({ ativo: true, licitacaoId: { not: LICITACAO_A } });
    });

    it('recusa quando falta no destino um tipo usado pela estação, listando qual', async () => {
      prisma.tipoParametro.findMany.mockResolvedValue([]);

      await expect(service.vincularEstacoes(LICITACAO_A, ['estacao-1'])).rejects.toThrow('Chuva');
      expect(prisma.estacao.updateMany).not.toHaveBeenCalled();
    });

    it('recusa licitação encerrada, estação repetida e estação inexistente', async () => {
      await expect(service.vincularEstacoes(LICITACAO_A, ['e', 'e'])).rejects.toBeInstanceOf(BadRequestException);

      prisma.estacao.findMany.mockResolvedValue([]);
      await expect(service.vincularEstacoes(LICITACAO_A, ['sumida'])).rejects.toBeInstanceOf(NotFoundException);

      prisma.licitacao.findUnique.mockResolvedValue(licitacao('ENCERRADA'));
      await expect(service.vincularEstacoes(LICITACAO_A, ['estacao-1'])).rejects.toThrow('encerrada');
    });

    it('estação que já é da licitação não muda nada', async () => {
      prisma.estacao.findMany.mockResolvedValue([{ ...estacaoDaOrigem, licitacaoId: LICITACAO_A }]);

      await expect(service.vincularEstacoes(LICITACAO_A, ['estacao-1'])).resolves.toEqual({
        estacoesVinculadas: 1,
        alertasInativados: 0,
      });
      expect(prisma.estacao.updateMany).not.toHaveBeenCalled();
    });
  });
});
