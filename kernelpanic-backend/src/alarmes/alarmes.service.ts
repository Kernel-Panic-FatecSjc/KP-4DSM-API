import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { StatusAlarme } from '../generated/prisma/client';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { EstacoesProximasService } from '../regiao/estacoes-proximas.service';
import type { Coordenadas } from '../regiao/regiao';
import { AlarmeHistoricoRespostaDto } from './dto/alarme-historico-resposta.dto';
import { AtualizarStatusAlarmeDto } from './dto/atualizar-status-alarme.dto';
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

// O alarme só avança no ciclo de vida: reabrir um alarme reconhecido ou
// resolvido apagaria o registro de que alguém já o tratou.
const ORDEM_STATUS: Record<StatusAlarme, number> = {
  ABERTO: 0,
  RECONHECIDO: 1,
  RESOLVIDO: 2,
};

@Injectable()
export class AlarmesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estacoesProximas: EstacoesProximasService,
  ) {}

  async listarHistorico(query: ListarAlarmesQueryDto, regiao?: Coordenadas): Promise<ListaAlarmesRespostaDto> {
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
          estacaoId: await this.estacoesProximas.filtroEstacao(query.estacaoId, regiao),
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

  /** Alarmes disparados a partir de `desde`, mais recentes primeiro (usado pelo tempo real). */
  async buscarRecentes(desde: Date, limite = 200): Promise<AlarmeHistoricoRespostaDto[]> {
    const registros = await this.prisma.alarme.findMany({
      where: { disparadoEm: { gte: desde } },
      include: INCLUDE_HISTORICO,
      orderBy: { disparadoEm: 'desc' },
      take: limite,
    });
    return registros.map((registro) => new AlarmeHistoricoRespostaDto(registro));
  }

  async buscarOpcoesFiltro(regiao?: Coordenadas): Promise<OpcoesFiltroRespostaDto> {
    const id = await this.estacoesProximas.filtroEstacao(undefined, regiao);
    const [estacoes, tiposParametro] = await Promise.all([
      this.prisma.estacao.findMany({ where: { id }, select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
      this.prisma.tipoParametro.findMany({ select: { id: true, nome: true }, orderBy: { nome: 'asc' } }),
    ]);

    return new OpcoesFiltroRespostaDto(estacoes, tiposParametro);
  }

  async atualizarStatus(id: string, dto: AtualizarStatusAlarmeDto): Promise<AlarmeHistoricoRespostaDto> {
    const alarme = await this.prisma.alarme.findUnique({ where: { id }, select: { status: true } });
    if (!alarme) {
      throw new NotFoundException('Alarme não encontrado');
    }

    if (ORDEM_STATUS[dto.status] <= ORDEM_STATUS[alarme.status]) {
      throw new ConflictException(
        `Não é possível voltar o alarme de ${alarme.status} para ${dto.status}`,
      );
    }

    const atualizado = await this.prisma.alarme.update({
      where: { id },
      data: { status: dto.status },
      include: INCLUDE_HISTORICO,
    });

    return new AlarmeHistoricoRespostaDto(atualizado);
  }
}
