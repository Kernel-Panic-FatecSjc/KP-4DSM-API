import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AuditoriaRespostaDto } from './dto/auditoria-resposta.dto';
import { ListaAuditoriaRespostaDto } from './dto/lista-auditoria-resposta.dto';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';

@Injectable()
export class AuditoriaService {
  constructor(private readonly prisma: PrismaService) {}

  async registrar(evento: {
    acao: string;
    entidade: string;
    entidadeId?: string;
    usuarioId?: string;
    detalhes?: Prisma.InputJsonValue;
  }): Promise<void> {
    await this.prisma.logAuditoria.create({
      data: {
        acao: evento.acao,
        entidade: evento.entidade,
        entidadeId: evento.entidadeId,
        usuarioId: evento.usuarioId,
        detalhes: evento.detalhes,
      },
    });
  }

  async listar(query: ListarAuditoriaQueryDto): Promise<ListaAuditoriaRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const where: Prisma.LogAuditoriaWhereInput = {
      acao: query.acao ? { contains: query.acao, mode: 'insensitive' } : undefined,
      entidade: query.entidade ? { contains: query.entidade, mode: 'insensitive' } : undefined,
      usuarioId: query.usuarioId || undefined,
      criadoEm: {
        gte: query.de ? new Date(query.de) : undefined,
        lte: query.ate ? new Date(query.ate) : undefined,
      },
    };

    const [registros, total] = await Promise.all([
      this.prisma.logAuditoria.findMany({
        where,
        include: { usuario: { select: { id: true, nome: true, email: true } } },
        orderBy: { criadoEm: 'desc' },
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
}