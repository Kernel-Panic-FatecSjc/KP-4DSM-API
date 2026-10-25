import { Injectable } from '@nestjs/common';
import type { LeituraErro, Prisma } from '../generated/prisma/client';
import { licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import { ListarLeiturasErroQueryDto } from './dto/listar-leituras-erro-query.dto';

export interface LeituraErroResposta extends Omit<LeituraErro, 'unixtime'> {
  unixtime: string;
}

/** Leituras que o tratamento recebeu e não gravou como medida (faixa física, sensor sem cadastro). */
@Injectable()
export class LeiturasErroService {
  constructor(private readonly prisma: PrismaService) {}

  async listar(query: ListarLeiturasErroQueryDto, usuario: UsuarioLogado) {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;
    const where: Prisma.LeituraErroWhereInput = {
      licitacaoId: licitacaoDoEscopo(usuario, query.licitacaoId),
      motivo: query.motivo,
      vidEstacao: query.vidEstacao?.trim() ? { contains: query.vidEstacao.trim(), mode: 'insensitive' } : undefined,
      registradoEm: {
        gte: query.de ? new Date(query.de) : undefined,
        lte: query.ate ? new Date(query.ate) : undefined,
      },
    };

    const [registros, total] = await Promise.all([
      this.prisma.leituraErro.findMany({
        where,
        orderBy: [{ registradoEm: 'desc' }, { id: 'desc' }],
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.leituraErro.count({ where }),
    ]);

    const itens: LeituraErroResposta[] = registros.map((registro) => ({
      ...registro,
      unixtime: registro.unixtime.toString(),
    }));
    return { itens, total, pagina, tamanho };
  }
}
