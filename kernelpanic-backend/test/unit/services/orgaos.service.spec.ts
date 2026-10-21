import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { Prisma } from '../../../src/generated/prisma/client';
import { OrgaosService } from '../../../src/orgaos/orgaos.service';
import { PrismaService } from '../../../src/prisma/prisma.service';

const ORGAO = {
  id: 'orgao-1',
  nome: 'Prefeitura',
  cnpj: '11222333000181',
  esfera: 'MUNICIPAL',
  municipio: 'São Paulo',
  uf: 'SP',
  ativo: true,
  criadoEm: new Date('2026-01-01T00:00:00Z'),
  atualizadoEm: new Date('2026-01-01T00:00:00Z'),
};

describe('OrgaosService', () => {
  let service: OrgaosService;
  const prismaMock = {
    orgaoPublico: {
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();
    const module = await Test.createTestingModule({
      providers: [
        OrgaosService,
        { provide: PrismaService, useValue: prismaMock },
      ],
    }).compile();
    service = module.get(OrgaosService);
  });

  it('lista com filtros e ordena por nome', async () => {
    prismaMock.orgaoPublico.findMany.mockResolvedValue([ORGAO]);
    await expect(
      service.listar({ busca: 'São Paulo', ativo: true }),
    ).resolves.toEqual([ORGAO]);
    expect(prismaMock.orgaoPublico.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ ativo: true, OR: expect.any(Array) }),
        orderBy: { nome: 'asc' },
      }),
    );
  });

  it('só pesquisa no CNPJ quando o termo contém apenas dígitos e pontuação', async () => {
    await service.listar({ busca: 'Escola 5' });
    const textoLivre =
      prismaMock.orgaoPublico.findMany.mock.calls[0][0].where.OR;
    expect(textoLivre).toEqual([
      { nome: { contains: 'Escola 5', mode: 'insensitive' } },
      { municipio: { contains: 'Escola 5', mode: 'insensitive' } },
    ]);

    await service.listar({ busca: '11.222.333/0001-81' });
    const buscaCnpj =
      prismaMock.orgaoPublico.findMany.mock.calls[1][0].where.OR;
    expect(buscaCnpj).toContainEqual({ cnpj: { contains: '11222333000181' } });
  });

  it('consulta por ID e retorna 404 quando não encontra', async () => {
    prismaMock.orgaoPublico.findUnique
      .mockResolvedValueOnce(ORGAO)
      .mockResolvedValueOnce(null);
    await expect(service.consultar(ORGAO.id)).resolves.toEqual(ORGAO);
    await expect(service.consultar('inexistente')).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('normaliza CNPJ e UF ao cadastrar', async () => {
    prismaMock.orgaoPublico.findUnique.mockResolvedValue(null);
    prismaMock.orgaoPublico.create.mockResolvedValue(ORGAO);
    await service.criar({
      nome: ORGAO.nome,
      cnpj: '11.222.333/0001-81',
      esfera: 'MUNICIPAL',
      municipio: ORGAO.municipio,
      uf: 'sp',
    });
    expect(prismaMock.orgaoPublico.create).toHaveBeenCalledWith({
      data: {
        nome: ORGAO.nome,
        cnpj: ORGAO.cnpj,
        esfera: 'MUNICIPAL',
        municipio: ORGAO.municipio,
        uf: 'SP',
      },
    });
  });

  it('recusa CNPJ já cadastrado e colisão de unicidade no banco', async () => {
    prismaMock.orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    await expect(
      service.criar({
        nome: 'Outro',
        cnpj: ORGAO.cnpj,
        esfera: 'MUNICIPAL',
        municipio: 'x',
        uf: 'SP',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
    expect(prismaMock.orgaoPublico.create).not.toHaveBeenCalled();

    prismaMock.orgaoPublico.findUnique.mockResolvedValue(null);
    prismaMock.orgaoPublico.create.mockRejectedValue(
      new Prisma.PrismaClientKnownRequestError('unique', {
        code: 'P2002',
        clientVersion: '7.10.0',
        meta: { target: ['cnpj'] },
      }),
    );
    await expect(
      service.criar({
        nome: 'Outro',
        cnpj: ORGAO.cnpj,
        esfera: 'MUNICIPAL',
        municipio: 'x',
        uf: 'SP',
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('atualiza os campos enviados e detecta duplicidade', async () => {
    prismaMock.orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    prismaMock.orgaoPublico.update.mockResolvedValue({
      ...ORGAO,
      nome: 'Prefeitura Nova',
    });
    await service.atualizar(ORGAO.id, { nome: 'Prefeitura Nova' });
    expect(prismaMock.orgaoPublico.update).toHaveBeenCalledWith({
      where: { id: ORGAO.id },
      data: { nome: 'Prefeitura Nova', cnpj: undefined, uf: undefined },
    });

    prismaMock.orgaoPublico.findUnique
      .mockResolvedValueOnce(ORGAO)
      .mockResolvedValueOnce({ id: 'outro' });
    await expect(
      service.atualizar(ORGAO.id, { cnpj: '00.000.000/0001-91' }),
    ).rejects.toBeInstanceOf(ConflictException);
  });

  it('inativa logicamente sem apagar o órgão', async () => {
    prismaMock.orgaoPublico.findUnique.mockResolvedValue(ORGAO);
    prismaMock.orgaoPublico.update.mockResolvedValue({
      ...ORGAO,
      ativo: false,
    });
    await service.inativar(ORGAO.id);
    expect(prismaMock.orgaoPublico.update).toHaveBeenCalledWith({
      where: { id: ORGAO.id },
      data: { ativo: false },
    });
  });
});
