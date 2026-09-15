import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { AlarmeHistoricoRespostaDto } from './dto/alarme-historico-resposta.dto';
import { ListaAlarmesRespostaDto } from './dto/lista-alarmes-resposta.dto';
import { ListarAlarmesQueryDto } from './dto/listar-alarmes-query.dto';
import { OpcoesFiltroRespostaDto } from './dto/opcoes-filtro-resposta.dto';

const INCLUDE_HISTORICO = {
  medida: true,
  alerta: {
    include: {
      parametro: {
        include: {
          estacao: true,
          tipoParametro: true,
        },
      },
    },
  },
} satisfies Prisma.AlarmeInclude;

@Injectable()
export class AlarmesService {
  constructor(private readonly prisma: PrismaService) {}

  async listarHistorico(query: ListarAlarmesQueryDto): Promise<ListaAlarmesRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanho = query.tamanho ?? 50;

    const where: Prisma.AlarmeWhereInput = {
      status: query.status,
      disparadoEm: {
        gte: query.de ? new Date(query.de) : undefined,
        lte: query.ate ? new Date(query.ate) : undefined,
      },
      alerta: {
        severidade: query.severidade,
        parametro: {
          estacaoId: query.estacaoId,
          tipoParametroId: query.tipoParametroId,
        },
      },
    };

    const [registros, total] = await Promise.all([
      this.prisma.alarme.findMany({
        where,
        include: INCLUDE_HISTORICO,
        orderBy: { disparadoEm: 'desc' },
        skip: (pagina - 1) * tamanho,
        take: tamanho,
      }),
      this.prisma.alarme.count({ where }),
    ]);

    return new ListaAlarmesRespostaDto(
      registros.map((registro) => new AlarmeHistoricoRespostaDto(registro)),
      total,
      pagina,
      tamanho,
    );
  }

  async buscarOpcoesFiltro(): Promise<OpcoesFiltroRespostaDto> {
    const [estacoes, tiposParametro] = await Promise.all([
      this.prisma.estacao.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      this.prisma.tipoParametro.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    ]);

    return new OpcoesFiltroRespostaDto(estacoes, tiposParametro);
  }
}
