import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { graficoLinhasSvg, montarRelatorioPdf, secaoPdf, tabelaPdf, type FiltroRelatorio, type SerieGrafico } from '../exportacao/pdf';

// Exportação do relatório de histórico climático (US09, SCRUM-56): CSV e PDF
// montados a partir do mesmo resultado da consulta da tela (SCRUM-54), para os
// arquivos baterem com o que o usuário viu.

export type Granularidade = 'hora' | 'dia';
export type Agregacao = 'SOMA' | 'MEDIA';

/** Uma linha da tabela: um período (hora ou dia) de um parâmetro numa estação. */
export interface LinhaHistoricoClimatico {
  /** Início do período, em UTC. */
  periodo: Date;
  estacaoId: string;
  estacaoNome: string;
  parametroId: string;
  parametroNome: string;
  unidade: string;
  /** Regra do tipo de parâmetro (SCRUM-53): SOMA tem acumulado, MEDIA não. */
  agregacao: Agregacao;
  minimo: number;
  maximo: number;
  media: number;
  /** Só para parâmetros de SOMA (ex.: precipitação); nulo nos de MEDIA. */
  acumulado: number | null;
}

/** Totalizador do período inteiro, por estação e parâmetro. */
export type TotalHistoricoClimatico = Omit<LinhaHistoricoClimatico, 'periodo'>;

export interface RelatorioHistoricoClimatico {
  filtros: {
    de: Date;
    ate: Date;
    granularidade: Granularidade;
    estacoes: { id: string; nome: string }[];
  };
  linhas: LinhaHistoricoClimatico[];
  totais: TotalHistoricoClimatico[];
}

export interface EmissaoRelatorio {
  emitidoEm?: Date;
  emitidoPor?: string;
  /** Licitação ou órgão, para o cabeçalho do PDF. */
  instituicao?: string;
}

const FUSO = 'America/Sao_Paulo';

/** Colunas da tabela da tela, com a unidade separada para o número ficar puro. */
export const CABECALHO_CSV_HISTORICO = ['Período', 'Estação', 'Parâmetro', 'Unidade', 'Mínimo', 'Máximo', 'Média', 'Acumulado'];

/** Linhas do CSV: período em ISO 8601 (UTC) e números sem formatação. */
export function linhasCsvHistorico(relatorio: RelatorioHistoricoClimatico): unknown[][] {
  return relatorio.linhas.map((linha) => [
    linha.periodo.toISOString(),
    linha.estacaoNome,
    linha.parametroNome,
    linha.unidade,
    arredondar(linha.minimo),
    arredondar(linha.maximo),
    arredondar(linha.media),
    linha.acumulado === null ? null : arredondar(linha.acumulado),
  ]);
}

export function nomeArquivoHistorico(relatorio: RelatorioHistoricoClimatico, extensao: 'csv' | 'pdf'): string {
  const { de, ate } = relatorio.filtros;
  return `historico-climatico_${dataIso(de)}_${dataIso(ate)}.${extensao}`;
}

export function filtrosHistorico(relatorio: RelatorioHistoricoClimatico): FiltroRelatorio[] {
  const { de, ate, granularidade, estacoes } = relatorio.filtros;
  return [
    { rotulo: 'Período', valor: `${dataHora(de)} a ${dataHora(ate)} (horário de Brasília)` },
    { rotulo: 'Granularidade', valor: granularidade === 'hora' ? 'Hora' : 'Dia' },
    { rotulo: 'Estações', valor: estacoes.map((estacao) => estacao.nome).join(', ') || 'Todas' },
  ];
}

export function documentoPdfHistorico(relatorio: RelatorioHistoricoClimatico, emissao: EmissaoRelatorio = {}): TDocumentDefinitions {
  const granularidade = relatorio.filtros.granularidade;
  const conteudo: Content[] = relatorio.linhas.length
    ? [
        ...graficosPorParametro(relatorio.linhas, granularidade),
        secaoPdf('Totalizadores do período'),
        tabelaPdf(
          ['Estação', 'Parâmetro', 'Mínimo', 'Máximo', 'Média', 'Acumulado'],
          relatorio.totais.map((total) => [
            total.estacaoNome,
            total.parametroNome,
            comUnidade(total.minimo, total.unidade),
            comUnidade(total.maximo, total.unidade),
            comUnidade(total.media, total.unidade),
            total.acumulado === null ? null : comUnidade(total.acumulado, total.unidade),
          ]),
          { larguras: ['*', '*', 60, 60, 60, 70], colunasNumero: [2, 3, 4, 5] },
        ),
        secaoPdf(granularidade === 'hora' ? 'Dados por hora' : 'Dados por dia'),
        tabelaPdf(
          ['Período', 'Estação', 'Parâmetro', 'Mínimo', 'Máximo', 'Média', 'Acumulado'],
          relatorio.linhas.map((linha) => [
            rotuloPeriodo(linha.periodo, granularidade),
            linha.estacaoNome,
            linha.parametroNome,
            comUnidade(linha.minimo, linha.unidade),
            comUnidade(linha.maximo, linha.unidade),
            comUnidade(linha.media, linha.unidade),
            linha.acumulado === null ? null : comUnidade(linha.acumulado, linha.unidade),
          ]),
          { larguras: [62, '*', '*', 56, 56, 56, 62], colunasNumero: [3, 4, 5, 6] },
        ),
      ]
    : [{ text: 'Nenhuma leitura encontrada para os filtros informados.', margin: [0, 12, 0, 0] }];

  return montarRelatorioPdf({
    titulo: 'Relatório de histórico climático',
    subtitulo: 'Comportamento das variáveis climáticas por período e estação',
    instituicao: emissao.instituicao,
    filtros: filtrosHistorico(relatorio),
    conteudo,
    emitidoEm: emissao.emitidoEm,
    emitidoPor: emissao.emitidoPor,
  });
}

/**
 * Um gráfico por parâmetro, uma linha por estação, como na tela: acumulado
 * para parâmetros de SOMA e média para os de MEDIA. Estação sem leitura num
 * período fica com 0 no acumulado e repete a média anterior, para as séries
 * dividirem o mesmo eixo X.
 */
function graficosPorParametro(linhas: LinhaHistoricoClimatico[], granularidade: Granularidade): Content[] {
  const parametros = new Map<string, LinhaHistoricoClimatico[]>();
  for (const linha of linhas) {
    parametros.set(linha.parametroId, [...(parametros.get(linha.parametroId) ?? []), linha]);
  }

  return [...parametros.values()].flatMap((doParametro) => {
    const { parametroNome, unidade, agregacao } = doParametro[0];
    const periodos = [...new Set(doParametro.map((linha) => linha.periodo.getTime()))].sort((a, b) => a - b);
    const estacoes = new Map<string, { nome: string; valores: Map<number, number> }>();
    for (const linha of doParametro) {
      const estacao = estacoes.get(linha.estacaoId) ?? { nome: linha.estacaoNome, valores: new Map() };
      estacao.valores.set(linha.periodo.getTime(), agregacao === 'SOMA' ? (linha.acumulado ?? 0) : linha.media);
      estacoes.set(linha.estacaoId, estacao);
    }

    const series: SerieGrafico[] = [...estacoes.values()].map((estacao) => {
      let anterior = 0;
      return {
        nome: estacao.nome,
        pontos: periodos.map((periodo) => {
          const valor = estacao.valores.get(periodo) ?? (agregacao === 'SOMA' ? 0 : anterior);
          anterior = valor;
          return { rotulo: rotuloPeriodo(new Date(periodo), granularidade), valor };
        }),
      };
    });

    return [
      secaoPdf(`${parametroNome} (${unidade}) · ${agregacao === 'SOMA' ? 'acumulado' : 'média'} por ${granularidade}`),
      { svg: graficoLinhasSvg(series) },
    ] as Content[];
  });
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

function comUnidade(valor: number, unidade: string): string {
  return `${valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} ${unidade}`;
}

function partes(data: Date): Record<string, string> {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(formatador.formatToParts(data).map((parte) => [parte.type, parte.value]));
}

function rotuloPeriodo(data: Date, granularidade: Granularidade): string {
  const { day, month, year, hour } = partes(data);
  return granularidade === 'dia' ? `${day}/${month}/${year}` : `${day}/${month} ${hour}h`;
}

function dataHora(data: Date): string {
  const { day, month, year, hour, minute } = partes(data);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}

function dataIso(data: Date): string {
  const { day, month, year } = partes(data);
  return `${year}-${month}-${day}`;
}
