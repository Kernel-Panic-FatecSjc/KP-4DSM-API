import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { exigirPeriodo, LINHAS_POR_LOTE_CSV } from '../exportacao/csv';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaRespostaDto } from './dto/auditoria-resposta.dto';
import { ListaAuditoriaRespostaDto } from './dto/lista-auditoria-resposta.dto';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';

const SELECIONAR_REGISTRO = {
  id: true,
  criadoEm: true,
  acao: true,
  entidade: true,
  entidadeId: true,
  enderecoIp: true,
  detalhes: true,
  licitacaoId: true,
  usuario: { select: { id: true, nome: true } },
} satisfies Prisma.LogAuditoriaSelect;

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(evento: {
    acao: string;
    entidade: string;
    entidadeId?: string;
    usuarioId?: string;
    /** Licitação de quem fez a ação (nula = Tecsus); ver autoria(). */
    licitacaoId?: string | null;
    enderecoIp?: string;
    detalhes?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.logAuditoria.create({
      data: {
        acao: evento.acao,
        entidade: evento.entidade,
        entidadeId: evento.entidadeId,
        usuarioId: evento.usuarioId,
        licitacaoId: evento.licitacaoId ?? null,
        enderecoIp: evento.enderecoIp,
        detalhes: evento.detalhes,
      },
    });
  }

  /**
   * O admin da licitação só lê a trilha da própria licitação; a Tecsus lê
   * tudo, inclusive as ações dela mesma (licitacaoId nulo).
   */
  private filtro(query: ListarAuditoriaQueryDto, usuario: UsuarioLogado): Prisma.LogAuditoriaWhereInput {
    return {
      licitacaoId: licitacaoDoEscopo(usuario, query.licitacaoId),
      acao: query.acao ? { contains: query.acao, mode: 'insensitive' } : undefined,
      entidade: query.entidade ? { contains: query.entidade, mode: 'insensitive' } : undefined,
      entidadeId: query.entidadeId || undefined,
      usuarioId: query.usuarioId || undefined,
      criadoEm: {
        gte: query.de ? new Date(query.de) : undefined,
        lte: query.ate ? new Date(query.ate) : undefined,
      },
    };
  }

  async listar(query: ListarAuditoriaQueryDto, usuario: UsuarioLogado): Promise<ListaAuditoriaRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const where = this.filtro(query, usuario);

    const [registros, total] = await Promise.all([
      this.prisma.logAuditoria.findMany({
        where,
        select: SELECIONAR_REGISTRO,
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.logAuditoria.count({ where }),
    ]);

    return new ListaAuditoriaRespostaDto(
      registros.map((registro) => new AuditoriaRespostaDto(registro)),
      total,
      pagina,
      tamanho,
    );
  }

  /**
   * Registros do período em lotes, por keyset (criadoEm, id): cada lote é uma
   * consulta indexada, sem OFFSET crescente e sem carregar o período inteiro.
   */
  async *exportar(query: ListarAuditoriaQueryDto, usuario: UsuarioLogado): AsyncGenerator<AuditoriaRespostaDto[]> {
    const { de, ate } = exigirPeriodo(query.de, query.ate);
    const base = this.filtro({ ...query, de: undefined, ate: undefined }, usuario);
    let cursor: { criadoEm: Date; id: string } | undefined;

    for (;;) {
      const registros = await this.prisma.logAuditoria.findMany({
        where: {
          AND: [
            base,
            { criadoEm: { gte: de, lte: ate } },
            cursor
              ? { OR: [{ criadoEm: { lt: cursor.criadoEm } }, { criadoEm: cursor.criadoEm, id: { lt: cursor.id } }] }
              : {},
          ],
        },
        select: SELECIONAR_REGISTRO,
        orderBy: [{ criadoEm: 'desc' }, { id: 'desc' }],
        take: LINHAS_POR_LOTE_CSV,
      });
      if (registros.length === 0) return;
      yield registros.map((registro) => new AuditoriaRespostaDto(registro));
      const ultimo = registros[registros.length - 1];
      cursor = { criadoEm: ultimo.criadoEm, id: ultimo.id };
      if (registros.length < LINHAS_POR_LOTE_CSV) return;
    }
  }
}
