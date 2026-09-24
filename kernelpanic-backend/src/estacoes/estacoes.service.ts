import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarEstacaoDto } from './dto/atualizar-estacao.dto';
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

  async atualizar(id: string, dto: AtualizarEstacaoDto): Promise<EstacaoComSensores> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { id },
      include: { parametros: { select: { id: true, tipoParametroId: true } } },
    });

    if (!estacao) {
      throw new NotFoundException('Estação não encontrada');
    }

    if (dto.vid && dto.vid !== estacao.vid) {
      const emUso = await this.prisma.estacao.findUnique({ where: { vid: dto.vid } });
      if (emUso) {
        throw new ConflictException('Já existe uma estação com este identificador');
      }
    }

    const sensores = dto.tipoParametroIds
      ? await this.planejarMudancaDeSensores(estacao.parametros, dto.tipoParametroIds)
      : undefined;

    return this.prisma.estacao.update({
      where: { id },
      data: {
        nome: dto.nome,
        endereco: dto.endereco,
        vid: dto.vid,
        latitude: dto.latitude,
        longitude: dto.longitude,
        statusOperacional: dto.statusOperacional,
        parametros: sensores,
      },
      include: INCLUIR_SENSORES,
    });
  }

  async inativar(id: string): Promise<EstacaoComSensores> {
    const estacao = await this.prisma.estacao.findUnique({ where: { id } });
    if (!estacao) {
      throw new NotFoundException('Estação não encontrada');
    }

    return this.prisma.estacao.update({
      where: { id },
      data: { statusOperacional: 'INATIVA' },
      include: INCLUIR_SENSORES,
    });
  }

  private async planejarMudancaDeSensores(
    atuais: { id: string; tipoParametroId: string }[],
    desejados: string[],
  ): Promise<Prisma.ParametroUpdateManyWithoutEstacaoNestedInput> {
    const identificadores = new Set(desejados);
    if (identificadores.size !== desejados.length) {
      throw new BadRequestException('Não é permitido associar o mesmo sensor mais de uma vez');
    }

    const existentes = await this.prisma.tipoParametro.findMany({
      where: { id: { in: desejados } },
      select: { id: true },
    });
    if (existentes.length !== desejados.length) {
      throw new BadRequestException('Um ou mais sensores selecionados não existem');
    }

    const aRemover = atuais.filter((parametro) => !identificadores.has(parametro.tipoParametroId));
    const aAdicionar = desejados.filter(
      (tipoParametroId) => !atuais.some((parametro) => parametro.tipoParametroId === tipoParametroId),
    );

    // Apagar um Parametro leva junto as Medida dele (onDelete: Cascade). Um
    // sensor que já coletou dados só sai do cadastro às custas da série
    // histórica, então a remoção é recusada em vez de destruir a medição.
    if (aRemover.length > 0) {
      const comMedidas = await this.prisma.medida.findFirst({
        where: { parametroId: { in: aRemover.map((parametro) => parametro.id) } },
        select: { parametroId: true },
      });
      if (comMedidas) {
        throw new ConflictException(
          'Não é possível remover um sensor que já possui medidas registradas',
        );
      }
    }

    return {
      deleteMany: aRemover.length > 0 ? { id: { in: aRemover.map(({ id }) => id) } } : undefined,
      create: aAdicionar.map((tipoParametroId) => ({ tipoParametroId })),
    };
  }
}
