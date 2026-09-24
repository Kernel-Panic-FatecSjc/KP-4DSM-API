import { BadRequestException, Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto, type PeriodoDashboard } from './dto/dashboard-query.dto';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarDados(query: DashboardQueryDto) {
    const { de, ate } = this.resolverPeriodo(query);
    const inicioUnix = BigInt(Math.floor(de.getTime() / 1000));
    const fimUnix = BigInt(Math.floor(ate.getTime() / 1000));

    const filtroMedidas: Prisma.MedidaWhereInput = {
      estacaoId: query.estacaoId,
      unixtime: { gte: inicioUnix, lte: fimUnix },
    };
    const filtroAlarmes: Prisma.AlarmeWhereInput = {
      status: 'ABERTO',
      disparadoEm: { gte: de, lte: ate },
      alerta: { parametro: { estacaoId: query.estacaoId } },
    };

    const [estacoes, medidas, alarmesAbertos] = await Promise.all([
      this.prisma.estacao.findMany({
        where: query.estacaoId ? { id: query.estacaoId } : undefined,
        select: { id: true, nome: true, endereco: true },
        orderBy: { nome: 'asc' },
      }),
      this.prisma.medida.findMany({
        where: filtroMedidas,
        include: {
          parametro: { include: { tipoParametro: true } },
          estacao: { select: { id: true, nome: true } },
        },
        orderBy: { unixtime: 'asc' },
        take: 5000,
      }),
      this.prisma.alarme.count({ where: filtroAlarmes }),
    ]);

    const series = new Map<
      string,
      {
        parametroId: string;
        nome: string;
        unidade: string;
        estacaoId: string;
        estacaoNome: string;
        pontos: { timestamp: string; valor: number }[];
      }
    >();

    for (const medida of medidas) {
      const chave = `${medida.estacaoId}:${medida.parametroId}`;
      const serie = series.get(chave) ?? {
        parametroId: medida.parametroId,
        nome: medida.parametro.tipoParametro.nome,
        unidade: medida.parametro.tipoParametro.unidade,
        estacaoId: medida.estacao.id,
        estacaoNome: medida.estacao.nome,
        pontos: [],
      };
      serie.pontos.push({
        timestamp: new Date(Number(medida.unixtime) * 1000).toISOString(),
        valor: medida.valor,
      });
      series.set(chave, serie);
    }

    const media = medidas.length
      ? medidas.reduce((total, medida) => total + medida.valor, 0) / medidas.length
      : null;

    return {
      periodo: { de: de.toISOString(), ate: ate.toISOString() },
      estacoes,
      indicadores: {
        estacoesAtivas: new Set(medidas.map((medida) => medida.estacaoId)).size,
        leituras: medidas.length,
        media,
        alarmesAbertos,
      },
      series: [...series.values()],
    };
  }

  private resolverPeriodo(query: DashboardQueryDto): { de: Date; ate: Date } {
    const periodo = query.periodo ?? (query.de || query.ate ? 'customizado' : '24h');

    if (periodo !== 'customizado' && (query.de || query.ate)) {
      throw new BadRequestException('Não informe de ou ate ao usar um período predefinido.');
    }

    if (periodo === 'customizado') {
      if (!query.de || !query.ate) {
        throw new BadRequestException('O período customizado exige de e ate.');
      }

      const de = new Date(query.de);
      const ate = new Date(query.ate);
      this.validarIntervalo(de, ate);
      return { de, ate };
    }

    const ate = new Date();
    const duracoes: Record<Exclude<PeriodoDashboard, 'customizado'>, number> = {
      '24h': UM_DIA_EM_MS,
      '7d': 7 * UM_DIA_EM_MS,
      mes: 30 * UM_DIA_EM_MS,
    };
    return { de: new Date(ate.getTime() - duracoes[periodo]), ate };
  }

  private validarIntervalo(de: Date, ate: Date): void {
    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
      throw new BadRequestException('As datas do período devem ser válidas.');
    }
    if (de > ate) {
      throw new BadRequestException('A data de início deve ser anterior ou igual à data final.');
    }
  }
}