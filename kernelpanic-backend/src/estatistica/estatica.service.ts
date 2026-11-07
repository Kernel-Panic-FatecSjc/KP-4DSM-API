import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { ConsultarEstatisticasDto } from './dto/estatistica-resposta';
import {
  ComparacaoEstacaoDto,
  DiferencaMetricaDto,
  PeriodoEstatisticoDto,
  RelatorioEstatisticoDto,
} from './dto/estatistica-relatorio';
import { EstatisticaEstacaoDto } from './dto/estatitisca-estacao';

interface Intervalo { inicio: Date; fim: Date }
interface LinhaEstatistica {
  estacaoId: string;
  estacaoNome: string;
  quantidade: bigint;
  media: number | null;
  mediana: number | null;
  desvioPadrao: number | null;
  variancia: number | null;
  quartil1: number | null;
  quartil2: number | null;
  quartil3: number | null;
  minimo: number | null;
  maximo: number | null;
}

const METRICAS = [
  'quantidade', 'media', 'mediana', 'desvioPadrao', 'variancia',
  'quartil1', 'quartil2', 'quartil3', 'minimo', 'maximo',
] as const;
type Metrica = (typeof METRICAS)[number];

@Injectable()
export class EstatisticaService {
  constructor(private readonly prisma: PrismaService) {}

  async comparar(query: ConsultarEstatisticasDto, usuario: UsuarioLogado): Promise<RelatorioEstatisticoDto> {
    const intervalos = query.periodos.map((periodo) => this.parsearPeriodo(periodo));
    this.validarSobreposicoes(intervalos);
    const ids = [...new Set(query.estacaoIds)];
    if (ids.length === 0) throw new BadRequestException('Informe ao menos uma estação');
    const licitacaoId = licitacaoDoEscopo(usuario);

    const periodos = await Promise.all(intervalos.map(async ({ inicio, fim }) => {
      const linhas = await this.buscarEstatisticas(ids, query.parametroId, inicio, fim, licitacaoId);
      const periodo = new PeriodoEstatisticoDto();
      periodo.inicio = inicio;
      periodo.fim = fim;
      periodo.estacoes = linhas.map((linha) => this.converterLinha(linha));
      return periodo;
    }));

    const referenciaPorEstacao = new Map(periodos[0].estacoes.map((estacao) => [estacao.estacaoId, estacao]));
    const comparacoes: ComparacaoEstacaoDto[] = [];
    for (let periodoComparadoIndice = 1; periodoComparadoIndice < periodos.length; periodoComparadoIndice++) {
      for (const atual of periodos[periodoComparadoIndice].estacoes) {
        const referencia = referenciaPorEstacao.get(atual.estacaoId);
        if (!referencia) continue;
        const comparacao = new ComparacaoEstacaoDto();
        comparacao.estacaoId = atual.estacaoId;
        comparacao.periodoReferenciaIndice = 0;
        comparacao.periodoComparadoIndice = periodoComparadoIndice;
        for (const metrica of METRICAS) {
          (comparacao as unknown as Record<Metrica, DiferencaMetricaDto | null>)[metrica] =
            this.diferenca(referencia[metrica], atual[metrica]);
        }
        comparacoes.push(comparacao);
      }
    }

    const relatorio = new RelatorioEstatisticoDto();
    relatorio.periodos = periodos;
    relatorio.metodoCalculo = 'Populacional: desvio padrão (STDDEV_POP) e variância (VAR_POP)';
    relatorio.comparacoes = comparacoes;
    return relatorio;
  }

  private parsearPeriodo(valor: string): Intervalo {
    const partes = valor.split('|');
    if (partes.length !== 2) {
      throw new BadRequestException('Cada período deve estar no formato ISO_INICIO|ISO_FIM');
    }
    const inicio = new Date(partes[0]);
    const fim = new Date(partes[1]);
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || inicio > fim) {
      throw new BadRequestException('Período inválido: início deve ser anterior ou igual ao fim');
    }
    return { inicio, fim };
  }

  private validarSobreposicoes(intervalos: Intervalo[]): void {
    for (let i = 0; i < intervalos.length; i++) {
      for (let j = i + 1; j < intervalos.length; j++) {
        if (intervalos[i].inicio <= intervalos[j].fim && intervalos[j].inicio <= intervalos[i].fim) {
          throw new BadRequestException('Os períodos informados não podem se sobrepor');
        }
      }
    }
  }

  private async buscarEstatisticas(
    ids: string[], parametroId: string, inicio: Date, fim: Date, licitacaoId?: string,
  ): Promise<LinhaEstatistica[]> {
    const filtroLicitacao = licitacaoId ? Prisma.sql`AND m."licitacaoId" = ${licitacaoId}` : Prisma.empty;
    const filtroEstacao = licitacaoId ? Prisma.sql`AND e."licitacaoId" = ${licitacaoId}` : Prisma.empty;
    return this.prisma.$queryRaw<LinhaEstatistica[]>(Prisma.sql`
      SELECT e."id" AS "estacaoId", e."nome" AS "estacaoNome",
        COUNT(m."id") AS "quantidade", AVG(m."valor") AS "media",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY m."valor") AS "mediana",
        stddev_pop(m."valor") AS "desvioPadrao", var_pop(m."valor") AS "variancia",
        percentile_cont(0.25) WITHIN GROUP (ORDER BY m."valor") AS "quartil1",
        percentile_cont(0.5) WITHIN GROUP (ORDER BY m."valor") AS "quartil2",
        percentile_cont(0.75) WITHIN GROUP (ORDER BY m."valor") AS "quartil3",
        MIN(m."valor") AS "minimo", MAX(m."valor") AS "maximo"
      FROM "estacoes" e
      LEFT JOIN "medidas" m ON m."estacaoId" = e."id"
        AND m."parametroId" = ${parametroId}
        AND m."unixtime" >= ${BigInt(Math.floor(inicio.getTime() / 1000))}
        AND m."unixtime" <= ${BigInt(Math.floor(fim.getTime() / 1000))}
        ${filtroLicitacao}
      WHERE e."id" IN (${Prisma.join(ids)}) ${filtroEstacao}
      GROUP BY e."id", e."nome"
      ORDER BY e."nome", e."id"
    `);
  }

  private converterLinha(linha: LinhaEstatistica): EstatisticaEstacaoDto {
    const dto = new EstatisticaEstacaoDto();
    dto.estacaoId = linha.estacaoId;
    dto.estacaoNome = linha.estacaoNome;
    for (const metrica of METRICAS) {
      const valor = linha[metrica];
      (dto as unknown as Record<Metrica, number | null>)[metrica] = valor === null ? null : Number(valor);
    }
    return dto;
  }

  private diferenca(referencia: number | null, atual: number | null): DiferencaMetricaDto | null {
    if (referencia === null || atual === null) return null;
    const diferenca = atual - referencia;
    const dto = new DiferencaMetricaDto();
    dto.diferencaAbsoluta = diferenca;
    dto.diferencaPercentual = referencia === 0 ? null : (diferenca / Math.abs(referencia)) * 100;
    return dto;
  }
}
