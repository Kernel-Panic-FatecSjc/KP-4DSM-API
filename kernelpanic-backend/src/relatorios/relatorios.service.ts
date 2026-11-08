import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import { dataDoFiltro } from './periodo';
import { HistoricoClimaticoQueryDto } from './dto/historico-climatico-query.dto';
import {
  EstatisticasHistoricoDto,
  HistoricoClimaticoRespostaDto,
  type EstacaoHistoricoClimaticoDto,
  type ParametroHistoricoClimaticoDto,
} from './dto/historico-climatico-resposta.dto';

interface AgregadoHistorico {
  estacaoId: string;
  estacaoNome: string;
  tipoParametroId: string;
  tipoParametroNome: string;
  unidade: string;
  agregacao: 'SOMA' | 'MEDIA';
  periodo: Date | null;
  totalPeriodo: number;
  valor: number;
  soma: number;
  media: number;
  minimo: number;
  maximo: number;
  leituras: bigint;
}

function formatarAgregado(row: AgregadoHistorico): EstatisticasHistoricoDto {
  const resultado = new EstatisticasHistoricoDto();
  if (row.periodo) resultado.periodo = row.periodo.toISOString();
  resultado.agregacao = row.agregacao;
  resultado.valor = row.valor;
  resultado.soma = row.soma;
  resultado.media = row.media;
  resultado.minimo = row.minimo;
  resultado.maximo = row.maximo;
  resultado.leituras = Number(row.leituras);
  return resultado;
}

@Injectable()
export class RelatoriosService {
  constructor(private readonly prisma: PrismaService) {}

  async historicoClimatico(
    query: HistoricoClimaticoQueryDto,
    usuario: UsuarioLogado,
  ): Promise<HistoricoClimaticoRespostaDto> {
    const de = dataDoFiltro(query.de);
    const ate = dataDoFiltro(query.ate, true);
    if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
      throw new BadRequestException('As datas do período devem ser válidas.');
    }
    if (de > ate) {
      throw new BadRequestException(
        'A data de início deve ser anterior ou igual à data final.',
      );
    }

    const licitacaoId = licitacaoDoEscopo(usuario) ?? null;
    const inicioUnix = BigInt(Math.floor(de.getTime() / 1000));
    const fimUnix = BigInt(Math.floor(ate.getTime() / 1000));
    const unidadeDataSql = query.granularidade === 'hora' ? 'hour' : 'day';
    const filtroLicitacao = licitacaoId
      ? Prisma.sql`AND m."licitacaoId" = ${licitacaoId}`
      : Prisma.empty;
    const filtroEstacoes = query.estacaoIds?.length
      ? Prisma.sql`AND m."estacaoId" IN (${Prisma.join(query.estacaoIds)})`
      : Prisma.empty;

    const linhas = await this.prisma.$queryRaw<AgregadoHistorico[]>`
      WITH leituras AS (
        SELECT
          e.id AS "estacaoId",
          e.nome AS "estacaoNome",
          tp.id AS "tipoParametroId",
          tp.nome AS "tipoParametroNome",
          tp.unidade AS "unidade",
          tp.agregacao::text AS "agregacao",
          m.valor AS "valor",
          date_trunc(${unidadeDataSql}, to_timestamp(m.unixtime::double precision), 'UTC') AS "periodo"
        FROM medidas m
        JOIN estacoes e ON e.id = m."estacaoId"
        JOIN parametros p ON p.id = m."parametroId"
        JOIN tipos_parametro tp ON tp.id = p."tipoParametroId"
        WHERE TRUE
          ${filtroLicitacao}
          AND m.unixtime >= ${inicioUnix}
          AND m.unixtime <= ${fimUnix}
          ${filtroEstacoes}
      )
      SELECT
        "estacaoId",
        "estacaoNome",
        "tipoParametroId",
        "tipoParametroNome",
        "unidade",
        "agregacao",
        "periodo",
        GROUPING("periodo")::int AS "totalPeriodo",
        CASE WHEN "agregacao" = 'SOMA' THEN SUM("valor")::float8 ELSE AVG("valor")::float8 END AS "valor",
        SUM("valor")::float8 AS "soma",
        AVG("valor")::float8 AS "media",
        MIN("valor")::float8 AS "minimo",
        MAX("valor")::float8 AS "maximo",
        COUNT(*) AS "leituras"
      FROM leituras
      GROUP BY GROUPING SETS (
        ("estacaoId", "estacaoNome", "tipoParametroId", "tipoParametroNome", "unidade", "agregacao", "periodo"),
        ("estacaoId", "estacaoNome", "tipoParametroId", "tipoParametroNome", "unidade", "agregacao")
      )
      ORDER BY "estacaoNome", "tipoParametroNome", "totalPeriodo" DESC, "periodo" ASC
    `;

    const estacoes = new Map<string, EstacaoHistoricoClimaticoDto>();
    const parametros = new Map<string, ParametroHistoricoClimaticoDto>();
    for (const linha of linhas) {
      let estacao = estacoes.get(linha.estacaoId);
      if (!estacao) {
        estacao = {
          id: linha.estacaoId,
          nome: linha.estacaoNome,
          parametros: [],
        };
        estacoes.set(estacao.id, estacao);
      }

      const chaveParametro = `${linha.estacaoId}:${linha.tipoParametroId}`;
      let parametro = parametros.get(chaveParametro);
      if (!parametro) {
        parametro = {
          id: linha.tipoParametroId,
          nome: linha.tipoParametroNome,
          unidade: linha.unidade,
          agregacao: linha.agregacao,
          periodos: [],
          totalPeriodo: new EstatisticasHistoricoDto(),
        };
        parametros.set(chaveParametro, parametro);
        estacao.parametros.push(parametro);
      }

      if (linha.totalPeriodo) {
        parametro.totalPeriodo = formatarAgregado(linha);
      } else {
        parametro.periodos.push(formatarAgregado(linha));
      }
    }

    const resposta = new HistoricoClimaticoRespostaDto();
    resposta.de = de.toISOString();
    resposta.ate = ate.toISOString();
    resposta.granularidade = query.granularidade;
    resposta.estacoes = [...estacoes.values()];
    return resposta;
  }
}
