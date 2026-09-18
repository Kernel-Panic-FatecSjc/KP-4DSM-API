import { BadRequestException, ConflictException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { CriarEstacaoDto } from './dto/criar-estacao.dto';
import { ListarEstacoesQueryDto } from './dto/listar-estacoes-query.dto';

const INCLUIR_SENSORES = {
  parametros: { include: { tipoParametro: true } },
} satisfies Prisma.EstacaoInclude;

type EstacaoComSensores = Prisma.EstacaoGetPayload<{ include: typeof INCLUIR_SENSORES }>;

@Injectable()
export class EstacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarEstacoesQueryDto): Promise<EstacaoComSensores[]> {
    const regiao = query.regiao?.trim();

    return this.prisma.estacao.findMany({
      where: {
        statusOperacional: query.status,
        endereco: regiao ? { contains: regiao, mode: 'insensitive' } : undefined,
        parametros: query.tipoParametroId
          ? { some: { tipoParametroId: query.tipoParametroId } }
          : undefined,
      },
      include: INCLUIR_SENSORES,
      orderBy: { nome: 'asc' },
    });
  }

  async criar(dto: CriarEstacaoDto, usuarioId: string): Promise<EstacaoComSensores> {
    const identificadores = new Set(dto.tipoParametroIds);
    if (identificadores.size !== dto.tipoParametroIds.length) {
      throw new BadRequestException('Não é permitido associar o mesmo sensor mais de uma vez');
    }

    const [estacaoExistente, sensores] = await Promise.all([
      this.prisma.estacao.findUnique({ where: { vid: dto.vid } }),
      this.prisma.tipoParametro.findMany({ where: { id: { in: dto.tipoParametroIds } } }),
    ]);

    if (estacaoExistente) {
      throw new ConflictException('Já existe uma estação com este identificador');
    }

    if (sensores.length !== dto.tipoParametroIds.length) {
      throw new BadRequestException('Um ou mais sensores selecionados não existem');
    }

    return this.prisma.estacao.create({
      data: {
        nome: dto.nome,
        endereco: dto.endereco,
        vid: dto.vid,
        latitude: dto.latitude,
        longitude: dto.longitude,
        usuarioId,
        parametros: {
          create: dto.tipoParametroIds.map((tipoParametroId) => ({ tipoParametroId })),
        },
      },
      include: INCLUIR_SENSORES,
    });
  }
}