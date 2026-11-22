import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { StatusLicitacao, TipoUsuario } from '../generated/prisma/client';
import type { Prisma, Usuario } from '../generated/prisma/client';
import { ehTecsus, licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { BuscarUsuariosQueryDto } from './dto/buscar-usuarios-query.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { INCLUIR_LICITACAO_USUARIO, type UsuarioComLicitacao } from './dto/usuario-resposta.dto';

const SALT_ROUNDS = 10;

/** Usuário com o status da licitação, para a sessão saber se é somente leitura. */
export type UsuarioDaSessao = Usuario & { licitacao: { status: StatusLicitacao } | null };

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * A Tecsus cadastra qualquer perfil; o admin da licitação só cadastra
   * USUARIO_LICITACAO na própria licitação (ver docs/regras-licitacao.md).
   */
  async criar(dto: CriarUsuarioDto, solicitante: UsuarioLogado): Promise<UsuarioComLicitacao> {
    const tipo = dto.tipo ?? TipoUsuario.USUARIO_LICITACAO;
    let licitacaoId = dto.licitacaoId;

    if (!ehTecsus(solicitante)) {
      if (tipo !== TipoUsuario.USUARIO_LICITACAO) {
        throw new ForbiddenException('O admin da licitação só cadastra usuários comuns');
      }
      licitacaoId = licitacaoDoEscopo(solicitante, dto.licitacaoId);
    }

    await this.validarPerfilELicitacao(tipo, licitacaoId ?? null);

    const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Já existe um usuário com este email');
    }

    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    return this.prisma.usuario.create({
      data: { nome: dto.nome, email: dto.email, senhaHash, tipo, licitacaoId: licitacaoId ?? null },
      include: INCLUIR_LICITACAO_USUARIO,
    });
  }

  async buscarTodos(query: BuscarUsuariosQueryDto, solicitante: UsuarioLogado): Promise<UsuarioComLicitacao[]> {
    const termo = query.busca?.trim();
    const where: Prisma.UsuarioWhereInput = {
      licitacaoId: licitacaoDoEscopo(solicitante, query.licitacaoId),
      tipo: query.tipo,
      OR: termo
        ? [
            { nome: { contains: termo, mode: 'insensitive' } },
            { email: { contains: termo, mode: 'insensitive' } },
          ]
        : undefined,
    };

    return this.prisma.usuario.findMany({
      where,
      include: INCLUIR_LICITACAO_USUARIO,
      orderBy: { criadoEm: 'asc' },
    });
  }

  async buscarPorId(id: string): Promise<UsuarioComLicitacao> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id }, include: INCLUIR_LICITACAO_USUARIO });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return usuario;
  }

  /** Consulta de um usuário por quem pode gerenciá-lo (ou por ele mesmo). */
  async buscarVisivel(id: string, solicitante: UsuarioLogado): Promise<UsuarioComLicitacao> {
    const usuario = await this.buscarPorId(id);
    if (id !== solicitante.sub) this.garantirPodeGerenciar(solicitante, usuario);
    return usuario;
  }

  /** null se não existir ou se o banco falhar: a sessão é recusada, sem 500. */
  async buscarParaSessao(id: string): Promise<UsuarioDaSessao | null> {
    try {
      return await this.prisma.usuario.findUnique({ where: { id }, include: { licitacao: { select: { status: true } } } });
    } catch {
      return null;
    }
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  async atualizar(id: string, dto: AtualizarUsuarioDto, solicitante: UsuarioLogado): Promise<UsuarioComLicitacao> {
    const usuario = await this.buscarPorId(id);
    // Cada um edita os próprios dados; os de outra pessoa, só quem a gerencia.
    if (id !== solicitante.sub) this.garantirPodeGerenciar(solicitante, usuario);

    const mudaPerfil = dto.tipo !== undefined || dto.licitacaoId !== undefined;
    if (mudaPerfil) {
      if (!ehTecsus(solicitante)) {
        throw new ForbiddenException('Só a Tecsus muda o perfil ou a licitação de um usuário');
      }
      if (id === solicitante.sub) {
        throw new ForbiddenException('Não é possível mudar o próprio perfil');
      }
      const tipo = dto.tipo ?? usuario.tipo;
      const licitacaoId = dto.licitacaoId === undefined ? usuario.licitacaoId : dto.licitacaoId;
      await this.validarPerfilELicitacao(tipo, licitacaoId, usuario.licitacaoId);
    }

    if (dto.email) {
      const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
      if (existente && existente.id !== id) {
        throw new ConflictException('Já existe um usuário com este email');
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash: dto.senha ? await bcrypt.hash(dto.senha, SALT_ROUNDS) : undefined,
        tipo: dto.tipo,
        licitacaoId: dto.tipo === TipoUsuario.ADMIN_TECSUS ? null : dto.licitacaoId,
      },
      include: INCLUIR_LICITACAO_USUARIO,
    });
  }

  async inativar(id: string, solicitante: UsuarioLogado): Promise<void> {
    if (id === solicitante.sub) {
      throw new ForbiddenException('Não é possível inativar o próprio usuário');
    }
    this.garantirPodeGerenciar(solicitante, await this.buscarPorId(id));
    await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
  }

  async ativar(id: string, solicitante: UsuarioLogado): Promise<void> {
    this.garantirPodeGerenciar(solicitante, await this.buscarPorId(id));
    await this.prisma.usuario.update({ where: { id }, data: { ativo: true } });
  }

  /** A Tecsus gerencia todos; o admin da licitação, só os usuários comuns dela. */
  private garantirPodeGerenciar(solicitante: UsuarioLogado, alvo: Usuario): void {
    if (ehTecsus(solicitante)) return;
    const mesmaLicitacao = alvo.licitacaoId !== null && alvo.licitacaoId === solicitante.licitacaoId;
    if (
      solicitante.tipo === TipoUsuario.ADMIN_LICITACAO &&
      mesmaLicitacao &&
      alvo.tipo === TipoUsuario.USUARIO_LICITACAO
    ) {
      return;
    }
    throw new ForbiddenException('Sem permissão para gerenciar este usuário');
  }

  /**
   * ADMIN_TECSUS não tem licitação; os outros perfis precisam de uma que
   * exista e não esteja encerrada (a não ser que o usuário já fosse dela).
   */
  private async validarPerfilELicitacao(
    tipo: TipoUsuario,
    licitacaoId: string | null,
    licitacaoAtual?: string | null,
  ): Promise<void> {
    if (tipo === TipoUsuario.ADMIN_TECSUS) {
      if (licitacaoId && licitacaoId !== licitacaoAtual) {
        throw new BadRequestException('Usuário da Tecsus não pertence a uma licitação');
      }
      return;
    }

    if (!licitacaoId) {
      throw new BadRequestException('Informe a licitação do usuário');
    }

    const licitacao = await this.prisma.licitacao.findUnique({
      where: { id: licitacaoId },
      select: { status: true },
    });
    if (!licitacao) {
      throw new BadRequestException('Licitação não encontrada');
    }
    if (licitacao.status === StatusLicitacao.ENCERRADA && licitacaoId !== licitacaoAtual) {
      throw new BadRequestException('Licitação encerrada não recebe usuários novos');
    }
  }
}
