import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { garantirAcessoLicitacao, licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EstacoesProximasService } from '../regiao/estacoes-proximas.service';
import type { Coordenadas } from '../regiao/regiao';
import { AlertaRespostaDto } from './dto/alerta-resposta.dto';
import { AtualizarAlertaDto } from './dto/atualizar-alerta.dto';
import { CriarAlertaDto } from './dto/criar-alerta.dto';
import { ListaAlertasRespostaDto } from './dto/lista-alertas-resposta.dto';
import { ListarAlertasQueryDto } from './dto/listar-alertas-query.dto';
import { OpcoesFiltroAlertasRespostaDto } from './dto/opcoes-filtro-alertas-resposta.dto';

const INCLUDE_RELACOES = {
  parametro: {
    include: {
      estacao: true,
      tipoParametro: true,
    },
  },
} satisfies Prisma.AlertaInclude;

@Injectable()
export class AlertasService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estacoesProximas: EstacoesProximasService,
  ) {}

  /** O alerta é da licitação da estação do parâmetro monitorado. */
  async criar(dto: CriarAlertaDto, usuario: UsuarioLogado) {
    const licitacaoId = await this.licitacaoDoParametro(dto.parametroId, usuario);

    return this.prisma.alerta.create({
      data: {
        operador: dto.operador,
        valorLimite: dto.valorLimite,
        severidade: dto.severidade,
        parametroId: dto.parametroId,
        licitacaoId,
      },
      include: INCLUDE_RELACOES,
    });
  }

  async atualizar(id: string, dto: AtualizarAlertaDto, usuario: UsuarioLogado) {
    const existente = await this.buscar(id, usuario);
    if (dto.parametroId && dto.parametroId !== existente.parametroId) {
      const licitacaoId = await this.licitacaoDoParametro(dto.parametroId, usuario);
      if (licitacaoId !== existente.licitacaoId) {
        throw new BadRequestException('O parâmetro monitorado precisa ser da licitação do alerta');
      }
    }

    return this.prisma.alerta.update({
      where: { id },
      data: dto,
      include: INCLUDE_RELACOES,
    });
  }

  async inativar(id: string, usuario: UsuarioLogado) {
    await this.buscar(id, usuario);

    // Apagar o alerta levaria junto os alarmes que ele disparou
    // (onDelete: Cascade), destruindo o histórico de ocorrências que a
    // auditoria precisa preservar. Desativar mantém a trilha intacta.
    return this.prisma.alerta.update({
      where: { id },
      data: { ativo: false },
      include: INCLUDE_RELACOES,
    });
  }

  /**
   * Visitante vê os alertas perto dele (de qualquer licitação: é a página
   * pública); quem está logado vê os da própria licitação, e a Tecsus todos.
   */
  async listar(
    query: ListarAlertasQueryDto,
    regiao: Coordenadas | undefined,
    usuario: UsuarioLogado | null,
  ): Promise<ListaAlertasRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;

    const where: Prisma.AlertaWhereInput = {
      licitacaoId: usuario ? licitacaoDoEscopo(usuario, query.licitacaoId) : undefined,
      severidade: query.severidade,
      ativo: query.ativo,
      parametro: {
        estacaoId: await this.estacoesProximas.filtroEstacao(query.estacaoId, regiao),
        tipoParametroId: query.tipoParametroId,
      },
    };

    const [registros, total] = await Promise.all([
      this.prisma.alerta.findMany({
        where,
        include: INCLUDE_RELACOES,
        orderBy: { criadoEm: 'desc' },
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.alerta.count({ where }),
    ]);

    return new ListaAlertasRespostaDto(
      registros.map((registro) => new AlertaRespostaDto(registro)),
      total,
      pagina,
      tamanho,
    );
  }

  async buscarOpcoesFiltro(
    regiao: Coordenadas | undefined,
    usuario: UsuarioLogado | null,
    licitacaoIdInformada?: string,
  ): Promise<OpcoesFiltroAlertasRespostaDto> {
    const estacaoId = await this.estacoesProximas.filtroEstacao(undefined, regiao);
    const licitacaoId = usuario ? licitacaoDoEscopo(usuario, licitacaoIdInformada) : undefined;
    const [estacoes, tiposParametro, parametros] = await Promise.all([
      this.prisma.estacao.findMany({
        where: { id: estacaoId, licitacaoId },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.tipoParametro.findMany({
        where: { licitacaoId },
        select: { id: true, nome: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.parametro.findMany({
        where: { estacaoId, estacao: { licitacaoId } },
        include: {
          estacao: { select: { id: true, nome: true } },
          tipoParametro: { select: { nome: true, unidade: true } },
        },
        orderBy: [{ estacao: { nome: 'asc' } }, { tipoParametro: { nome: 'asc' } }],
      }),
    ]);

    return new OpcoesFiltroAlertasRespostaDto(
      estacoes,
      tiposParametro,
      parametros.map((parametro) => ({
        id: parametro.id,
        nome: parametro.tipoParametro.nome,
        unidade: parametro.tipoParametro.unidade,
        estacaoId: parametro.estacao.id,
        estacaoNome: parametro.estacao.nome,
      })),
    );
  }

  private async buscar(id: string, usuario: UsuarioLogado) {
    const alerta = await this.prisma.alerta.findUnique({ where: { id } });
    if (!alerta) throw new NotFoundException('Alerta não encontrado');
    garantirAcessoLicitacao(usuario, alerta.licitacaoId);
    return alerta;
  }

  private async licitacaoDoParametro(parametroId: string, usuario: UsuarioLogado): Promise<string> {
    const parametro = await this.prisma.parametro.findUnique({
      where: { id: parametroId },
      select: { estacao: { select: { licitacaoId: true } } },
    });
    if (!parametro) {
      throw new BadRequestException('O parâmetro monitorado selecionado não existe');
    }
    garantirAcessoLicitacao(usuario, parametro.estacao.licitacaoId);
    return parametro.estacao.licitacaoId;
  }
}
