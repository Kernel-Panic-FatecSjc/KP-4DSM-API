import { BadRequestException, Injectable } from '@nestjs/common';
import { SeveridadeAlerta, type Prisma } from '../generated/prisma/client';
import { licitacaoDoEscopo } from '../autenticacao/escopo-licitacao';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { PrismaService } from '../prisma/prisma.service';
import { EstacoesProximasService } from '../regiao/estacoes-proximas.service';
import { RAIO_REGIAO_KM } from '../regiao/regiao';
import { IncidentesQueryDto } from './dto/incidentes-query.dto';
import type { RelatorioIncidentesDto, ResumoEstacaoDto, ResumoSeveridadeDto } from './dto/incidentes-resposta.dto';
import { agruparOcorrencias, TOLERANCIA_PADRAO_MINUTOS, type AlarmeParaOcorrencia, type Ocorrencia } from './ocorrencias';
import type { OrgaoLaudo } from './laudo-incidentes';
import { dataDoFiltro } from './periodo';

/**
 * Teto de alarmes lidos por consulta. Um alerta violado o tempo todo numa
 * estação a cada 5 min gera ~105 mil alarmes por ano; acima disso o período
 * (ou os filtros) precisam ser reduzidos.
 */
export const LIMITE_ALARMES_INCIDENTES = 200_000;

const ORDEM_SEVERIDADE: SeveridadeAlerta[] = [SeveridadeAlerta.ATENCAO, SeveridadeAlerta.ALERTA, SeveridadeAlerta.EMERGENCIA];

const SELECIONAR_ALARME = {
  id: true,
  status: true,
  observacao: true,
  reconhecidoEm: true,
  resolvidoEm: true,
  reconhecidoPor: { select: { id: true, nome: true } },
  resolvidoPor: { select: { id: true, nome: true } },
  medida: { select: { unixtime: true, valor: true } },
  alerta: {
    select: {
      id: true,
      operador: true,
      valorLimite: true,
      severidade: true,
      parametro: {
        select: {
          estacao: { select: { id: true, nome: true } },
          tipoParametro: { select: { id: true, nome: true, unidade: true } },
        },
      },
    },
  },
} satisfies Prisma.AlarmeSelect;

type AlarmeSelecionado = Prisma.AlarmeGetPayload<{ select: typeof SELECIONAR_ALARME }>;

export interface PeriodoIncidentes {
  de: Date;
  ate: Date;
}

@Injectable()
export class IncidentesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly estacoesProximas: EstacoesProximasService,
  ) {}

  /** Relatório 2 (US10): ocorrências de alarmes no período, com resumos por severidade e por estação. */
  async relatorio(query: IncidentesQueryDto, usuario: UsuarioLogado): Promise<RelatorioIncidentesDto> {
    const { de, ate } = periodoDoRelatorio(query);
    const licitacaoId = licitacaoDoEscopo(usuario, query.licitacaoId);
    const toleranciaMinutos = query.toleranciaMinutos ?? TOLERANCIA_PADRAO_MINUTOS;
    const regiao =
      query.latitude !== undefined && query.longitude !== undefined
        ? { latitude: query.latitude, longitude: query.longitude, raioKm: query.raioKm ?? RAIO_REGIAO_KM }
        : undefined;

    const estacaoId = regiao
      ? { in: await this.estacoesProximas.buscarIds(regiao, regiao.raioKm) }
      : undefined;

    const registros = await this.prisma.alarme.findMany({
      where: {
        medida: {
          unixtime: { gte: BigInt(Math.floor(de.getTime() / 1000)), lte: BigInt(Math.floor(ate.getTime() / 1000)) },
        },
        alerta: {
          licitacaoId,
          severidade: query.severidade,
          parametro: {
            estacaoId,
            estacao: query.endereco ? { endereco: { contains: query.endereco, mode: 'insensitive' } } : undefined,
          },
        },
      },
      select: SELECIONAR_ALARME,
      take: LIMITE_ALARMES_INCIDENTES + 1,
    });
    if (registros.length > LIMITE_ALARMES_INCIDENTES) {
      throw new BadRequestException(
        `O período tem mais de ${LIMITE_ALARMES_INCIDENTES.toLocaleString('pt-BR')} alarmes: reduza o período ou use mais filtros`,
      );
    }

    const ocorrencias = agruparOcorrencias(registros.map(paraOcorrencia), toleranciaMinutos);

    return {
      de: de.toISOString(),
      ate: ate.toISOString(),
      toleranciaMinutos,
      filtros: {
        severidade: query.severidade,
        regiao,
        endereco: query.endereco,
        licitacaoId,
      },
      resumoPorSeveridade: resumirPorSeveridade(ocorrencias),
      resumoPorEstacao: resumirPorEstacao(ocorrencias),
      ocorrencias,
    };
  }

  /** Nome de quem emite e o órgão da licitação do relatório (nulo quando a Tecsus consulta todas). */
  async emissor(usuario: UsuarioLogado, licitacaoId: string | undefined): Promise<EmissorLaudo> {
    const [registro, orgao] = await Promise.all([
      this.prisma.usuario.findUnique({ where: { id: usuario.sub }, select: { nome: true } }),
      licitacaoId
        ? this.prisma.licitacao.findUnique({
            where: { id: licitacaoId },
            select: { orgaoNome: true, orgaoMunicipio: true, orgaoUf: true, numeroContrato: true, codigoIdentificador: true },
          })
        : null,
    ]);
    return { emitidoPor: registro?.nome ?? usuario.email, orgao: orgao ?? null };
  }
}

export interface EmissorLaudo {
  emitidoPor: string;
  orgao: OrgaoLaudo | null;
}

export function periodoDoRelatorio(query: Pick<IncidentesQueryDto, 'de' | 'ate'>): PeriodoIncidentes {
  const de = dataDoFiltro(query.de);
  const ate = dataDoFiltro(query.ate, true);
  if (Number.isNaN(de.getTime()) || Number.isNaN(ate.getTime())) {
    throw new BadRequestException('As datas do período devem ser válidas.');
  }
  if (de > ate) {
    throw new BadRequestException('A data de início deve ser anterior ou igual à data final.');
  }
  return { de, ate };
}

function paraOcorrencia(alarme: AlarmeSelecionado): AlarmeParaOcorrencia {
  const { parametro } = alarme.alerta;
  return {
    id: alarme.id,
    status: alarme.status,
    unixtime: Number(alarme.medida.unixtime),
    valor: alarme.medida.valor,
    reconhecidoEm: alarme.reconhecidoEm,
    reconhecidoPor: alarme.reconhecidoPor,
    resolvidoEm: alarme.resolvidoEm,
    resolvidoPor: alarme.resolvidoPor,
    observacao: alarme.observacao,
    alerta: {
      id: alarme.alerta.id,
      operador: alarme.alerta.operador,
      valorLimite: alarme.alerta.valorLimite,
      severidade: alarme.alerta.severidade,
    },
    estacao: parametro.estacao,
    parametro: parametro.tipoParametro,
  };
}

/** As três severidades, em ordem crescente, mesmo as que não tiveram ocorrência. */
export function resumirPorSeveridade(ocorrencias: Ocorrencia[]): ResumoSeveridadeDto[] {
  return ORDEM_SEVERIDADE.map((severidade) => {
    const daSeveridade = ocorrencias.filter((ocorrencia) => ocorrencia.severidade === severidade);
    return {
      severidade,
      ocorrencias: daSeveridade.length,
      duracaoTotalSegundos: somar(daSeveridade, 'duracaoSegundos'),
      leituras: somar(daSeveridade, 'leituras'),
    };
  });
}

/** Estações com ocorrência, da que teve mais ocorrências para a que teve menos (empate: nome). */
export function resumirPorEstacao(ocorrencias: Ocorrencia[]): ResumoEstacaoDto[] {
  const porEstacao = new Map<string, Ocorrencia[]>();
  for (const ocorrencia of ocorrencias) {
    porEstacao.set(ocorrencia.estacao.id, [...(porEstacao.get(ocorrencia.estacao.id) ?? []), ocorrencia]);
  }

  return [...porEstacao.values()]
    .map((daEstacao) => ({
      estacao: daEstacao[0].estacao,
      ocorrencias: daEstacao.length,
      duracaoTotalSegundos: somar(daEstacao, 'duracaoSegundos'),
      leituras: somar(daEstacao, 'leituras'),
      maiorSeveridade: daEstacao.reduce(
        (maior, ocorrencia) =>
          ORDEM_SEVERIDADE.indexOf(ocorrencia.severidade) > ORDEM_SEVERIDADE.indexOf(maior) ? ocorrencia.severidade : maior,
        daEstacao[0].severidade,
      ),
    }))
    .sort((a, b) => b.ocorrencias - a.ocorrencias || a.estacao.nome.localeCompare(b.estacao.nome, 'pt-BR'));
}

function somar(ocorrencias: Ocorrencia[], campo: 'duracaoSegundos' | 'leituras'): number {
  return ocorrencias.reduce((total, ocorrencia) => total + ocorrencia[campo], 0);
}
