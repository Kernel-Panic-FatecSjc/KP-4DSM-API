import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { StatusLicitacao, StatusOperacionalEstacao } from '../generated/prisma/client';
import { ehTecsus, garantirAcessoLicitacao, licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { BrokerService } from '../broker/broker.service';
import { PrismaService } from '../prisma/prisma.service';
import { gerarChaveIngestao } from './chave-ingestao';
import { AtualizarEstacaoDto } from './dto/atualizar-estacao.dto';
import { CriarEstacaoDto } from './dto/criar-estacao.dto';
import { ListarEstacoesQueryDto } from './dto/listar-estacoes-query.dto';

const INCLUIR_SENSORES = {
  parametros: { include: { tipoParametro: true } },
  licitacao: { select: { id: true, codigoIdentificador: true } },
} satisfies Prisma.EstacaoInclude;

export type EstacaoComSensores = Prisma.EstacaoGetPayload<{
  include: typeof INCLUIR_SENSORES;
}>;

export interface EstacaoCriada {
  estacao: EstacaoComSensores;
  chaveIngestao: string;
}

export interface EstacoesPaginadas {
  itens: EstacaoComSensores[];
  total: number;
  pagina: number;
  tamanho: number;
}

@Injectable()
export class EstacoesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly broker: BrokerService,
  ) {}

  async listar(query: ListarEstacoesQueryDto, usuario: UsuarioLogado): Promise<EstacoesPaginadas> {
    const regiao = query.regiao?.trim();
    const busca = query.busca?.trim();
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const where: Prisma.EstacaoWhereInput = {
      licitacaoId: licitacaoDoEscopo(usuario, query.licitacaoId),
      statusOperacional: query.status,
      endereco: regiao ? { contains: regiao, mode: 'insensitive' } : undefined,
      OR: busca
        ? [
            { nome: { contains: busca, mode: 'insensitive' } },
            { vid: { contains: busca, mode: 'insensitive' } },
          ]
        : undefined,
      parametros: query.tipoParametroId ? { some: { tipoParametroId: query.tipoParametroId } } : undefined,
    };

    const [itens, total] = await this.prisma.$transaction([
      this.prisma.estacao.findMany({
        where,
        include: INCLUIR_SENSORES,
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.estacao.count({ where }),
    ]);

    return { itens, total, pagina, tamanho };
  }

  /** Hierarquia licitação → estações → sensores (o acesso à licitação já foi conferido). */
  listarDaLicitacao(licitacaoId: string): Promise<EstacaoComSensores[]> {
    return this.prisma.estacao.findMany({
      where: { licitacaoId },
      include: INCLUIR_SENSORES,
      orderBy: { nome: 'asc' },
    });
  }

  async buscar(id: string, usuario: UsuarioLogado): Promise<EstacaoComSensores> {
    const estacao = await this.prisma.estacao.findUnique({ where: { id }, include: INCLUIR_SENSORES });
    if (!estacao) {
      throw new NotFoundException('Estação não encontrada');
    }
    garantirAcessoLicitacao(usuario, estacao.licitacaoId);
    return estacao;
  }

  /**
   * Cadastra a estação já com a chave de ingestão, devolvida só desta vez, e a
   * cadastra no broker com a mesma chave. O broker entra na transação: se ele
   * recusar, a estação não fica gravada sem credencial.
   */
  async criar(dto: CriarEstacaoDto, usuario: UsuarioLogado): Promise<EstacaoCriada> {
    const licitacaoId = ehTecsus(usuario) ? dto.licitacaoId : licitacaoDoEscopo(usuario, dto.licitacaoId);
    if (!licitacaoId) {
      throw new BadRequestException('Informe a licitação da estação');
    }
    await this.garantirLicitacaoAberta(licitacaoId);

    const tipoParametroIds = dto.tipoParametroIds ?? [];
    if (new Set(tipoParametroIds).size !== tipoParametroIds.length) {
      throw new BadRequestException('Não é permitido associar o mesmo sensor mais de uma vez');
    }

    const estacaoExistente = await this.prisma.estacao.findUnique({ where: { vid: dto.vid } });
    if (estacaoExistente) {
      throw new ConflictException('Já existe uma estação com este identificador');
    }
    await this.garantirSensoresDaLicitacao(tipoParametroIds, licitacaoId);

    const { chave, hash } = gerarChaveIngestao();
    const estacao = await this.prisma.$transaction(async (tx) => {
      const criada = await tx.estacao.create({
        data: {
          nome: dto.nome,
          endereco: dto.endereco,
          vid: dto.vid,
          latitude: dto.latitude,
          longitude: dto.longitude,
          chaveIngestaoHash: hash,
          usuarioId: usuario.sub,
          licitacaoId,
          parametros: {
            create: tipoParametroIds.map((tipoParametroId) => ({ tipoParametroId })),
          },
        },
        include: INCLUIR_SENSORES,
      });
      await this.broker.cadastrarEstacao(criada.vid, chave);
      return criada;
    });

    return { estacao, chaveIngestao: chave };
  }

  /**
   * Troca a chave de ingestão da estação (na API e no broker): a anterior para
   * de valer na hora. A nova é devolvida só desta vez; o banco guarda o hash.
   */
  async regenerarChaveIngestao(id: string, usuario: UsuarioLogado): Promise<string> {
    const estacao = await this.buscar(id, usuario);
    const { chave, hash } = gerarChaveIngestao();
    await this.prisma.$transaction(async (tx) => {
      await tx.estacao.update({ where: { id }, data: { chaveIngestaoHash: hash } });
      await this.broker.cadastrarEstacao(estacao.vid, chave);
    });
    return chave;
  }

  async atualizar(id: string, dto: AtualizarEstacaoDto, usuario: UsuarioLogado): Promise<EstacaoComSensores> {
    const estacao = await this.prisma.estacao.findUnique({
      where: { id },
      include: { parametros: { select: { id: true, tipoParametroId: true } } },
    });

    if (!estacao) {
      throw new NotFoundException('Estação não encontrada');
    }
    garantirAcessoLicitacao(usuario, estacao.licitacaoId);

    const vidMudou = Boolean(dto.vid && dto.vid !== estacao.vid);
    if (vidMudou) {
      const emUso = await this.prisma.estacao.findUnique({ where: { vid: dto.vid } });
      if (emUso) {
        throw new ConflictException('Já existe uma estação com este identificador');
      }
    }

    const sensores = dto.tipoParametroIds
      ? await this.planejarMudancaDeSensores(estacao.parametros, dto.tipoParametroIds, estacao.licitacaoId)
      : undefined;

    return this.prisma.$transaction(async (tx) => {
      const atualizada = await tx.estacao.update({
        where: { id },
        data: {
          nome: dto.nome,
          endereco: dto.endereco,
          vid: dto.vid,
          latitude: dto.latitude,
          longitude: dto.longitude,
          statusOperacional: dto.statusOperacional,
          parametros: sensores,
          // A chave e a credencial do broker são do vid: com outro vid a estação
          // precisa de chave nova (POST /estacoes/:id/chave-ingestao).
          chaveIngestaoHash: vidMudou ? null : undefined,
        },
        include: INCLUIR_SENSORES,
      });
      if (vidMudou) await this.broker.removerEstacao(estacao.vid);
      return atualizada;
    });
  }

  async inativar(id: string, usuario: UsuarioLogado): Promise<EstacaoComSensores> {
    await this.buscar(id, usuario);

    return this.prisma.estacao.update({
      where: { id },
      data: { statusOperacional: StatusOperacionalEstacao.INATIVA },
      include: INCLUIR_SENSORES,
    });
  }

  private async garantirLicitacaoAberta(licitacaoId: string): Promise<void> {
    const licitacao = await this.prisma.licitacao.findUnique({ where: { id: licitacaoId }, select: { status: true } });
    if (!licitacao) {
      throw new BadRequestException('Licitação não encontrada');
    }
    if (licitacao.status === StatusLicitacao.ENCERRADA) {
      throw new BadRequestException('Licitação encerrada não recebe estações');
    }
  }

  /** Os sensores da estação são tipos de parâmetro da mesma licitação (regra de consistência). */
  private async garantirSensoresDaLicitacao(tipoParametroIds: string[], licitacaoId: string): Promise<void> {
    if (tipoParametroIds.length === 0) return;
    const sensores = await this.prisma.tipoParametro.findMany({
      where: { id: { in: tipoParametroIds } },
      select: { id: true, licitacaoId: true },
    });
    if (sensores.length !== tipoParametroIds.length) {
      throw new BadRequestException('Um ou mais sensores selecionados não existem');
    }
    if (sensores.some((sensor) => sensor.licitacaoId !== licitacaoId)) {
      throw new BadRequestException('Os sensores precisam ser da mesma licitação da estação');
    }
  }

  private async planejarMudancaDeSensores(
    atuais: { id: string; tipoParametroId: string }[],
    desejados: string[],
    licitacaoId: string,
  ): Promise<Prisma.ParametroUpdateManyWithoutEstacaoNestedInput> {
    const identificadores = new Set(desejados);
    if (identificadores.size !== desejados.length) {
      throw new BadRequestException('Não é permitido associar o mesmo sensor mais de uma vez');
    }
    await this.garantirSensoresDaLicitacao(desejados, licitacaoId);

    const aRemover = atuais.filter((parametro) => !identificadores.has(parametro.tipoParametroId));
    const aAdicionar = desejados.filter(
      (tipoParametroId) => !atuais.some((parametro) => parametro.tipoParametroId === tipoParametroId),
    );

    // Apagar um Parametro tentaria levar junto as Medida dele (onDelete:
    // Cascade), e o trigger que mantém as medidas imutáveis barra isso. A
    // checagem aqui responde 409 com mensagem clara antes de chegar ao banco.
    if (aRemover.length > 0) {
      const comMedidas = await this.prisma.medida.findFirst({
        where: { parametroId: { in: aRemover.map((parametro) => parametro.id) } },
        select: { parametroId: true },
      });
      if (comMedidas) {
        throw new ConflictException('Não é possível remover um sensor que já possui medidas registradas');
      }
    }

    return {
      deleteMany: aRemover.length > 0 ? { id: { in: aRemover.map(({ id }) => id) } } : undefined,
      create: aAdicionar.map((tipoParametroId) => ({ tipoParametroId })),
    };
  }
}
