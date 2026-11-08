import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import type { ConsultarEstatisticasDto } from './dto/estatistica-resposta';
import { RelatorioEstatisticoDto } from './dto/estatistica-relatorio';
import { EstatisticaEstacaoDto } from './dto/estatitisca-estacao';

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

@Injectable()
export class EstatisticaService {
  constructor(private readonly prisma: PrismaService) {}

  async comparar(query: ConsultarEstatisticasDto, usuario: UsuarioLogado): Promise<RelatorioEstatisticoDto> {
    const inicio = new Date(query.dataInicio);
    const fim = new Date(query.dataFim);
    if (!Number.isFinite(inicio.getTime()) || !Number.isFinite(fim.getTime()) || inicio > fim) {
      throw new BadRequestException('Período inválido: dataInicio deve ser anterior ou igual a dataFim');
    }
    const ids = [...new Set(query.estacaoIds)];
    if (ids.length < 2) throw new BadRequestException('Informe ao menos duas estações distintas');
    const licitacaoId = licitacaoDoEscopo(usuario);

    const linhas = await this.prisma.$queryRaw<LinhaEstatistica[]>`
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
        AND m."parametroId" = ${query.parametroId}
        AND m."unixtime" >= ${BigInt(Math.floor(inicio.getTime() / 1000))}
        AND m."unixtime" <= ${BigInt(Math.floor(fim.getTime() / 1000))}
        AND (${licitacaoId ?? null}::text IS NULL OR m."licitacaoId" = ${licitacaoId ?? null})
      WHERE e."id" IN (${Prisma.join(ids)})
        AND (${licitacaoId ?? null}::text IS NULL OR e."licitacaoId" = ${licitacaoId ?? null})
      GROUP BY e."id", e."nome"
      ORDER BY e."nome", e."id"
    `;

    const relatorio = new RelatorioEstatisticoDto();
    relatorio.parametroId = query.parametroId;
    relatorio.dataInicio = inicio;
    relatorio.dataFim = fim;
    relatorio.metodoCalculo = 'Populacional: desvio padrão (STDDEV_POP) e variância (VAR_POP)';
    relatorio.estacoes = linhas.map((linha) => Object.assign(new EstatisticaEstacaoDto(), {
      ...linha,
      quantidade: Number(linha.quantidade),
      media: linha.media === null ? null : Number(linha.media),
      mediana: linha.mediana === null ? null : Number(linha.mediana),
      desvioPadrao: linha.desvioPadrao === null ? null : Number(linha.desvioPadrao),
      variancia: linha.variancia === null ? null : Number(linha.variancia),
      quartil1: linha.quartil1 === null ? null : Number(linha.quartil1),
      quartil2: linha.quartil2 === null ? null : Number(linha.quartil2),
      quartil3: linha.quartil3 === null ? null : Number(linha.quartil3),
      minimo: linha.minimo === null ? null : Number(linha.minimo),
      maximo: linha.maximo === null ? null : Number(linha.maximo),
    }));
    return relatorio;
  }
}
