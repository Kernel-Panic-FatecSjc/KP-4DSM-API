import { Injectable } from '@nestjs/common';
import type { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

@Injectable()
export class DashboardService {
  constructor(private readonly prisma: PrismaService) {}

  async buscarDados(query: DashboardQueryDto) {
    const ate = query.ate ? new Date(query.ate) : new Date();
    const de = query.de ? new Date(query.de) : new Date(ate.getTime() - UM_DIA_EM_MS);
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
}