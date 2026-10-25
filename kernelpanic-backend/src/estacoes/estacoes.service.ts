import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import {
  StatusContrato,
  StatusOperacionalEstacao,
} from '../generated/prisma/client';
import { gerarChaveIngestao } from './chave-ingestao';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarEstacaoDto } from './dto/atualizar-estacao.dto';
import { CriarEstacaoDto } from './dto/criar-estacao.dto';
import { ListarEstacoesQueryDto } from './dto/listar-estacoes-query.dto';

const INCLUIR_SENSORES = {
  parametros: { include: { tipoParametro: true } },
  contrato: { select: { id: true, numero: true } },
} satisfies Prisma.EstacaoInclude;

type EstacaoComSensores = Prisma.EstacaoGetPayload<{
  include: typeof INCLUIR_SENSORES;
}>;

export interface EstacaoCriada {
  estacao: EstacaoComSensores;
  chaveIngestao: string;
}

@Injectable()
export class EstacoesService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarEstacoesQueryDto): Promise<EstacaoComSensores[]> {
    const regiao = query.regiao?.trim();

    return this.prisma.estacao.findMany({
      where: {
        statusOperacional: query.status,
        endereco: regiao
          ? { contains: regiao, mode: 'insensitive' }
          : undefined,
        contratoId: query.contratoId,
        parametros: query.tipoParametroId
          ? { some: { tipoParametroId: query.tipoParametroId } }
          : undefined,
      },
      include: INCLUIR_SENSORES,
      orderBy: { nome: 'asc' },
    });
  }

  async listarPorContrato(contratoId: string): Promise<EstacaoComSensores[]> {
    const contrato = await this.prisma.contrato.findUnique({
      where: { id: contratoId },
      select: { id: true },
    });
    if (!contrato) {
      throw new NotFoundException('Contrato não encontrado');
    }

    return this.listar({ contratoId });
  }

  async vincularAoContrato(
    contratoId: string,
    estacaoIds: string[],
  ): Promise<number> {
    if (new Set(estacaoIds).size !== estacaoIds.length) {
      throw new BadRequestException(
        'Não é permitido informar a mesma estação mais de uma vez',
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const contrato = await tx.contrato.findUnique({
        where: { id: contratoId },
        select: { id: true, status: true },
      });
      if (!contrato) {
        throw new NotFoundException('Contrato não encontrado');
      }
      if (contrato.status !== StatusContrato.VIGENTE) {
        throw new BadRequestException(
          'Só é possível vincular estações a um contrato vigente',
        );
      }

      const estacoes = await tx.estacao.findMany({
        where: { id: { in: estacaoIds } },
        select: { id: true, statusOperacional: true, contratoId: true },
      });
      if (estacoes.length !== estacaoIds.length) {
        throw new NotFoundException(
          'Uma ou mais estações não foram encontradas',
        );
      }
      if (
        estacoes.some(
          (estacao) =>
            estacao.statusOperacional !== StatusOperacionalEstacao.ATIVA,
        )
      ) {
        throw new BadRequestException('Só é possível vincular estações ativas');
      }
      if (
        estacoes.some(
          (estacao) =>
            estacao.contratoId !== null && estacao.contratoId !== contratoId,
        )
      ) {
        throw new ConflictException(
          'Uma ou mais estações já estão vinculadas a outro contrato',
        );
      }

      const idsParaVincular = estacoes
        .filter((estacao) => estacao.contratoId === null)
        .map((estacao) => estacao.id);
      if (idsParaVincular.length === 0) {
        return estacaoIds.length;
      }

      const resultado = await tx.estacao.updateMany({
        where: {
          id: { in: idsParaVincular },
          contratoId: null,
          statusOperacional: StatusOperacionalEstacao.ATIVA,
        },
        data: { contratoId },
      });
      if (resultado.count !== idsParaVincular.length) {
        throw new ConflictException(
          'Uma ou mais estações foram alteradas durante a vinculação',
        );
      }

      return estacaoIds.length;
    });
  }

  async desvincularDoContrato(
    contratoId: string,
    estacaoId: string,
  ): Promise<void> {
    await this.prisma.$transaction(async (tx) => {
      const contrato = await tx.contrato.findUnique({
        where: { id: contratoId },
        select: { id: true },
      });
      if (!contrato) {
        throw new NotFoundException('Contrato não encontrado');
      }

      const estacao = await tx.estacao.findUnique({
        where: { id: estacaoId },
        select: { id: true, contratoId: true },
      });
      if (!estacao) {
        throw new NotFoundException('Estação não encontrada');
      }
      if (estacao.contratoId !== contratoId) {
        if (estacao.contratoId !== null) {
          throw new ConflictException(
            'A estação está vinculada a outro contrato',
          );
        }
        throw new NotFoundException(
          'A estação não está vinculada a este contrato',
        );
      }

      const resultado = await tx.estacao.updateMany({
        where: { id: estacao.id, contratoId },
        data: { contratoId: null },
      });
      if (resultado.count !== 1) {
        throw new ConflictException(
          'O vínculo da estação foi alterado durante a operação',
        );
      }
    });
  }

  /** Cadastra a estação já com a chave de ingestão, devolvida só desta vez. */
  async criar(dto: CriarEstacaoDto, usuarioId: string): Promise<EstacaoCriada> {
    const tipoParametroIds = dto.tipoParametroIds ?? [];
    const identificadores = new Set(tipoParametroIds);
    if (identificadores.size !== tipoParametroIds.length) {
      throw new BadRequestException(
        'Não é permitido associar o mesmo sensor mais de uma vez',
      );
    }

    const [estacaoExistente, sensores] = await Promise.all([
      this.prisma.estacao.findUnique({ where: { vid: dto.vid } }),
      this.prisma.tipoParametro.findMany({
        where: { id: { in: tipoParametroIds } },
      }),
    ]);

    if (estacaoExistente) {
      throw new ConflictException(
        'Já existe uma estação com este identificador',
      );
    }

    if (sensores.length !== tipoParametroIds.length) {
      throw new BadRequestException(
        'Um ou mais sensores selecionados não existem',
      );
    }

    const { chave, hash } = gerarChaveIngestao();
    const estacao = await this.prisma.estacao.create({
      data: {
        nome: dto.nome,
        endereco: dto.endereco,
        vid: dto.vid,
        latitude: dto.latitude,
        longitude: dto.longitude,
        chaveIngestaoHash: hash,
        usuarioId,
        parametros: {
          create: tipoParametroIds.map((tipoParametroId) => ({
            tipoParametroId,
          })),
        },
      },
      include: INCLUIR_SENSORES,
    });

    return { estacao, chaveIngestao: chave };
  }

  /**
   * Troca a chave de ingestão da estação: a anterior para de valer na hora.
   * A nova é devolvida só desta vez; o banco guarda apenas o hash.
   */
  async regenerarChaveIngestao(id: string): Promise<string> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { id },
      select: { id: true },
    });
    if (!estacao) {
      throw new NotFoundException('Estação não encontrada');
    }

    const { chave, hash } = gerarChaveIngestao();
    await this.prisma.estacao.update({
      where: { id },
      data: { chaveIngestaoHash: hash },
    });
    return chave;
  }

  async atualizar(
    id: string,
    dto: AtualizarEstacaoDto,
  ): Promise<EstacaoComSensores> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { id },
      include: { parametros: { select: { id: true, tipoParametroId: true } } },
    });

    if (!estacao) {
      throw new NotFoundException('Estação não encontrada');
    }

    if (dto.vid && dto.vid !== estacao.vid) {
      const emUso = await this.prisma.estacao.findUnique({
        where: { vid: dto.vid },
      });
      if (emUso) {
        throw new ConflictException(
          'Já existe uma estação com este identificador',
        );
      }
    }

    const sensores = dto.tipoParametroIds
      ? await this.planejarMudancaDeSensores(
          estacao.parametros,
          dto.tipoParametroIds,
        )
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
      throw new BadRequestException(
        'Não é permitido associar o mesmo sensor mais de uma vez',
      );
    }

    const existentes = await this.prisma.tipoParametro.findMany({
      where: { id: { in: desejados } },
      select: { id: true },
    });
    if (existentes.length !== desejados.length) {
      throw new BadRequestException(
        'Um ou mais sensores selecionados não existem',
      );
    }

    const aRemover = atuais.filter(
      (parametro) => !identificadores.has(parametro.tipoParametroId),
    );
    const aAdicionar = desejados.filter(
      (tipoParametroId) =>
        !atuais.some(
          (parametro) => parametro.tipoParametroId === tipoParametroId,
        ),
    );

    // Apagar um Parametro tentaria levar junto as Medida dele (onDelete:
    // Cascade), e o trigger que mantém as medidas imutáveis barra isso. A
    // checagem aqui responde 409 com mensagem clara antes de chegar ao banco.
    if (aRemover.length > 0) {
      const comMedidas = await this.prisma.medida.findFirst({
        where: {
          parametroId: { in: aRemover.map((parametro) => parametro.id) },
        },
        select: { parametroId: true },
      });
      if (comMedidas) {
        throw new ConflictException(
          'Não é possível remover um sensor que já possui medidas registradas',
        );
      }
    }

    return {
      deleteMany:
        aRemover.length > 0
          ? { id: { in: aRemover.map(({ id }) => id) } }
          : undefined,
      create: aAdicionar.map((tipoParametroId) => ({ tipoParametroId })),
    };
  }
}
