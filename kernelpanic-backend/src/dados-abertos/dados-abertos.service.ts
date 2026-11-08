import { BadRequestException, Injectable } from '@nestjs/common';
import { Prisma } from '../generated/prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { TAMANHO_PAGINA_PADRAO, type MedidasAbertasQueryDto } from './dto/medidas-abertas-query.dto';
import type { AlarmesAbertosQueryDto } from './dto/alarmes-abertos-query.dto';
import type { AlarmesAbertosRespostaDto } from './dto/alarmes-abertos-resposta.dto';
import type { EstacoesAbertasQueryDto } from './dto/estacoes-abertas-query.dto';
import type { EstacoesAbertasRespostaDto } from './dto/estacoes-abertas-resposta.dto';
import type { MedidasAbertasRespostaDto } from './dto/medidas-abertas-resposta.dto';

const DIA_MS = 24 * 60 * 60 * 1000;
/** Teto do período por granularidade: a rota é pública e a agregação roda no banco. */
export const LIMITE_DIAS = { hora: 31, dia: 366 } as const;

/** `ate` só com a data vale o dia inteiro, como nos relatórios. */
function periodoLimitado(textoDe: string, textoAte: string, limiteDias: number): { de: Date; ate: Date } {
  const de = new Date(textoDe);
  const ate = new Date(textoAte);
  if (/^\d{4}-\d{2}-\d{2}$/.test(textoAte)) ate.setUTCHours(23, 59, 59, 999);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
    throw new BadRequestException('As datas do período devem ser válidas.');
  }
  if (de > ate) {
    throw new BadRequestException('A data de início deve ser anterior ou igual à data final.');
  }
  if (ate.getTime() - de.getTime() > limiteDias * DIA_MS) {
    throw new BadRequestException(`O período máximo é de ${limiteDias} dias.`);
  }
  return { de, ate };
}

export function periodoDaConsulta(query: Pick<MedidasAbertasQueryDto, 'de' | 'ate' | 'granularidade'>): { de: Date; ate: Date } {
  return periodoLimitado(query.de, query.ate, LIMITE_DIAS[query.granularidade]);
}

/** O histórico de alarmes aceita até um ano por consulta. */
export const LIMITE_DIAS_ALARMES = 366;

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

  /** Catálogo de todas as estações. Sem usuário, endereço, vid nem chave. */
  async estacoes(query: EstacoesAbertasQueryDto): Promise<EstacoesAbertasRespostaDto> {
    const pagina = query.pagina ?? 1;
    const tamanhoPagina = query.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO;
    const where = query.status ? { statusOperacional: query.status } : {};

    const [total, estacoes] = await Promise.all([
      this.prisma.estacao.count({ where }),
      this.prisma.estacao.findMany({
        where,
        select: {
          id: true,
          nome: true,
          latitude: true,
          longitude: true,
          statusOperacional: true,
          parametros: { select: { tipoParametro: { select: { nome: true, unidade: true } } }, orderBy: { tipoParametro: { nome: 'asc' } } },
        },
        orderBy: [{ nome: 'asc' }, { id: 'asc' }],
        skip: (pagina - 1) * tamanhoPagina,
        take: tamanhoPagina,
      }),
    ]);

    return {
      dados: estacoes.map(({ parametros, ...estacao }) => ({ ...estacao, sensores: parametros.map((p) => p.tipoParametro) })),
      paginacao: { pagina, tamanhoPagina, total },
    };
  }

  /** Histórico de alarmes de todas as licitações no período. Sem dados de usuário. */
  async alarmes(query: AlarmesAbertosQueryDto): Promise<AlarmesAbertosRespostaDto> {
    const { de, ate } = periodoLimitado(query.de, query.ate, LIMITE_DIAS_ALARMES);
    const pagina = query.pagina ?? 1;
    const tamanhoPagina = query.tamanhoPagina ?? TAMANHO_PAGINA_PADRAO;
    const where: Prisma.AlarmeWhereInput = {
      disparadoEm: { gte: de, lte: ate },
      ...(query.status && { status: query.status }),
      ...(query.severidade && { alerta: { severidade: query.severidade } }),
      ...(query.estacaoId && { medida: { estacaoId: query.estacaoId } }),
    };

    const [total, alarmes] = await Promise.all([
      this.prisma.alarme.count({ where }),
      this.prisma.alarme.findMany({
        where,
        select: {
          id: true,
          disparadoEm: true,
          status: true,
          alerta: { select: { operador: true, valorLimite: true, severidade: true } },
          medida: {
            select: {
              valor: true,
              estacao: { select: { id: true, nome: true } },
              parametro: { select: { tipoParametro: { select: { nome: true } } } },
            },
          },
        },
        orderBy: [{ disparadoEm: 'desc' }, { id: 'asc' }],
        skip: (pagina - 1) * tamanhoPagina,
        take: tamanhoPagina,
      }),
    ]);

    return {
      dados: alarmes.map((alarme) => ({
        id: alarme.id,
        disparadoEm: alarme.disparadoEm.toISOString(),
        estacaoId: alarme.medida.estacao.id,
        estacaoNome: alarme.medida.estacao.nome,
        parametro: alarme.medida.parametro.tipoParametro.nome,
        operador: alarme.alerta.operador,
        valorLimite: alarme.alerta.valorLimite,
        valorMedido: alarme.medida.valor,
        severidade: alarme.alerta.severidade,
        status: alarme.status,
      })),
      paginacao: { pagina, tamanhoPagina, total },
    };
  }
}
