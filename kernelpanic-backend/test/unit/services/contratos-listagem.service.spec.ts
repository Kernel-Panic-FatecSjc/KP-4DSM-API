import { StatusContrato } from '../../../src/generated/prisma/client';
import { ContratosService } from '../../../src/contratos/contratos.service';
import { ListarContratosQueryDto } from '../../../src/contratos/dto/listar-contratos-query.dto';
import { PrismaService } from '../../../src/prisma/prisma.service';

const ORGAO = { id: 'orgao-1', nome: 'Prefeitura', cnpj: null };
const CONTRATO = {
  id: 'contrato-1',
  numero: 'CTR-2026-001',
  objeto: 'Monitoramento',
  inicioVigencia: new Date('2026-01-01T00:00:00.000Z'),
  fimVigencia: new Date('2026-12-31T23:59:59.999Z'),
  status: StatusContrato.VIGENTE,
  criadoEm: new Date('2026-01-01T00:00:00.000Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00.000Z'),
  encerradoEm: null,
  orgaoId: ORGAO.id,
  orgao: ORGAO,
};

describe('ContratosService.listar', () => {
  const prismaMock = {
    contrato: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    estacao: { groupBy: jest.fn() },
    $transaction: jest.fn(),
  };
  const service = new ContratosService(prismaMock as unknown as PrismaService);

  beforeEach(() => {
    jest.clearAllMocks();
    prismaMock.$transaction.mockImplementation((operacoes) =>
      Promise.all(operacoes),
    );
    prismaMock.contrato.findMany.mockResolvedValue([CONTRATO]);
    prismaMock.contrato.count.mockResolvedValue(1);
    prismaMock.estacao.groupBy.mockResolvedValue([
      { contratoId: CONTRATO.id, _count: { _all: 3 } },
    ]);
  });

  it('filtra, pagina e retorna o órgão e a quantidade de estações', async () => {
    const query = Object.assign(new ListarContratosQueryDto(), {
      status: StatusContrato.VIGENTE,
      orgaoId: ORGAO.id,
      busca: '  CTR-2026  ',
      pagina: 3,
      tamanho: 5,
    });

    const resultado = await service.listar(query);
    const where = {
      status: StatusContrato.VIGENTE,
      orgaoId: ORGAO.id,
      OR: [
        { numero: { contains: 'CTR-2026', mode: 'insensitive' } },
        { objeto: { contains: 'CTR-2026', mode: 'insensitive' } },
        { orgao: { nome: { contains: 'CTR-2026', mode: 'insensitive' } } },
      ],
    };

    expect(prismaMock.contrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where,
        include: { orgao: true },
        skip: 10,
        take: 5,
      }),
    );
    expect(prismaMock.contrato.count).toHaveBeenCalledWith({ where });
    expect(prismaMock.estacao.groupBy).toHaveBeenCalledWith({
      by: ['contratoId'],
      where: { contratoId: { in: [CONTRATO.id] } },
      _count: { _all: true },
    });
    expect(resultado).toMatchObject({
      total: 1,
      pagina: 3,
      tamanho: 5,
      contratos: [{ orgao: ORGAO, quantidadeEstacoes: 3 }],
    });
  });

  it('usa os padrões e evita consultar estações sem contratos', async () => {
    prismaMock.contrato.findMany.mockResolvedValue([]);
    prismaMock.contrato.count.mockResolvedValue(0);

    const resultado = await service.listar(new ListarContratosQueryDto());

    expect(prismaMock.contrato.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { status: undefined, orgaoId: undefined, OR: undefined },
        skip: 0,
        take: 10,
      }),
    );
    expect(resultado).toMatchObject({
      contratos: [],
      total: 0,
      pagina: 1,
      tamanho: 10,
    });
    expect(prismaMock.estacao.groupBy).not.toHaveBeenCalled();
  });
});
