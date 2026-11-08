import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TAMANHO_PAGINA_PADRAO, type MedidasAbertasQueryDto } from './dto/medidas-abertas-query.dto';
import type { MedidasAbertasRespostaDto } from './dto/medidas-abertas-resposta.dto';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Teto do período por granularidade: a rota é pública e a agregação roda no banco. */
export const LIMITE_DIAS = { hora: 31, dia: 366 } as const;

/** `ate` só com a data vale o dia inteiro, como nos relatórios. */
export function periodoDaConsulta(query: Pick<MedidasAbertasQueryDto, 'de' | 'ate' | 'granularidade'>): { de: Date; ate: Date } {
  const de = new Date(query.de);
  const ate = new Date(query.ate);
  if (/^\d{4}-\d{2}-\d{2}$/.test(query.ate)) ate.setUTCHours(23, 59, 59, 999);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
    throw new BadRequestException('As datas do período devem ser válidas.');
  }
  if (de > ate) {
    throw new BadRequestException('A data de início deve ser anterior ou igual à data final.');
  }
  const limite = LIMITE_DIAS[query.granularidade];
  if (ate.getTime() - de.getTime() > limite * DIA_MS) {
    throw new BadRequestException(`O período máximo na granularidade "${query.granularidade}" é de ${limite} dias.`);
  }
  return { de, ate };
}

interface LinhaMedida {
  estacaoId: string;
  estacaoNome: string;
  parametro: string;
  unidade: string;
  agregacao: string;
  inicio: Date;
  valor: number;
  quantidadeLeituras: bigint;
  total: bigint;
}

@Injectable()
export class DadosAbertosService {
  constructor(private readonly prisma: PrismaService) {}

  /** Medidas de todas as licitações, agregadas por hora ou dia no banco. Só leitura. */
  async medidas(query: MedidasAbertasQueryDto): Promise<MedidasAbertasRespostaDto> {
    const { de, ate } = periodoDaConsulta(query);
    const pagina = query.pagina ?? 1;
    const tamanhoPagina = query.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO;
    const unidadeSql = query.granularidade === 'hora' ? 'hour' : 'day';
    const filtroEstacao = query.estacaoId ? Prisma.sql`AND m."estacaoId" = ${query.estacaoId}` : Prisma.empty;
    const filtroParametro = query.parametro ? Prisma.sql`AND LOWER(tp.nome) = LOWER(${query.parametro})` : Prisma.empty;

    const linhas = await this.prisma.$queryRaw<LinhaMedida[]>`
      SELECT
        e.id AS "estacaoId",
        e.nome AS "estacaoNome",
        tp.nome AS "parametro",
        tp.unidade AS "unidade",
        tp.agregacao::text AS "agregacao",
        date_trunc(${unidadeSql}, to_timestamp(m.unixtime::double precision), 'UTC') AS "inicio",
        (CASE WHEN tp.agregacao = 'SOMA' THEN SUM(m.valor) ELSE AVG(m.valor) END)::float8 AS "valor",
        COUNT(*) AS "quantidadeLeituras",
        COUNT(*) OVER () AS "total"
      FROM medidas m
      JOIN estacoes e ON e.id = m."estacaoId"
      JOIN parametros p ON p.id = m."parametroId"
      JOIN tipos_parametro tp ON tp.id = p."tipoParametroId"
      WHERE m.unixtime >= ${BigInt(Math.floor(de.getTime() / 1000))}
        AND m.unixtime <= ${BigInt(Math.floor(ate.getTime() / 1000))}
        ${filtroEstacao}
        ${filtroParametro}
      GROUP BY e.id, e.nome, tp.id, tp.nome, tp.unidade, tp.agregacao, "inicio"
      ORDER BY "inicio", e.nome, tp.nome, e.id, tp.id
      LIMIT ${tamanhoPagina} OFFSET ${(pagina - 1) * tamanhoPagina}
    `;

    return {
      dados: linhas.map((linha) => ({
        estacaoId: linha.estacaoId,
        estacaoNome: linha.estacaoNome,
        parametro: linha.parametro,
        unidade: linha.unidade,
        inicio: linha.inicio.toISOString(),
        granularidade: query.granularidade,
        agregacao: linha.agregacao,
        valor: linha.valor,
        quantidadeLeituras: Number(linha.quantidadeLeituras),
      })),
      // Página além do fim vem sem linhas e, portanto, sem o total.
      paginacao: { pagina, tamanhoPagina, total: linhas.length ? Number(linhas[0].total) : 0 },
    };
  }
}
