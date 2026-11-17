import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import { graficoLinhasSvg, montarRelatorioPdf, secaoPdf, tabelaPdf, type FiltroRelatorio, type SerieGrafico } from '../exportacao/pdf';
import type {
  EstatisticasHistoricoDto,
  HistoricoClimaticoRespostaDto,
  ParametroHistoricoClimaticoDto,
} from './dto/historico-climatico-resposta.dto';

// Exportação do relatório de histórico climático (US09, SCRUM-56): CSV e PDF
// montados a partir da mesma resposta de GET /relatorios/historico-climatico
// (SCRUM-54) que a tela usa, com as mesmas colunas e os períodos em UTC, para
// os arquivos baterem com o que o usuário viu.

/** Largura útil do A4 deitado (842 - margens de 40). */
const LARGURA_PDF = 762;

/**
 * Acima disso a tabela por período sai do PDF (o CSV traz todas as linhas):
 * um ano por hora de várias estações daria milhares de páginas.
 */
export const LIMITE_LINHAS_TABELA_PDF = 2000;

/** Colunas da tabela da tela, com o período na frente e a unidade separada para o número ficar puro. */
export const CABECALHO_CSV_HISTORICO = [
  'Período',
  'Estação',
  'Parâmetro',
  'Unidade',
  'Agregação',
  'Consolidado',
  'Soma',
  'Média',
  'Mínimo',
  'Máximo',
  'Leituras',
];

const COLUNAS_ESTATISTICAS = ['Agregação', 'Consolidado', 'Soma', 'Média', 'Mínimo', 'Máximo', 'Leituras'];

export interface FiltrosExportacaoHistorico {
  /** Estações pedidas no filtro; vazio quando a consulta foi de todas. */
  estacaoIds: string[];
}

export interface EmissaoRelatorio {
  emitidoEm?: Date;
  emitidoPor?: string;
  /** Licitação ou órgão, para o cabeçalho do PDF. */
  instituicao?: string;
}

interface LinhaParametro {
  estacaoId: string;
  estacaoNome: string;
  parametro: ParametroHistoricoClimaticoDto;
}

function linhasParametro(relatorio: HistoricoClimaticoRespostaDto): LinhaParametro[] {
  return relatorio.estacoes.flatMap((estacao) =>
    estacao.parametros.map((parametro) => ({ estacaoId: estacao.id, estacaoNome: estacao.nome, parametro })),
  );
}

/** Quantidade de linhas por período (sem os totais): a mesma que vai para o CSV e a tabela do PDF. */
export function totalLinhasPeriodo(relatorio: HistoricoClimaticoRespostaDto): number {
  return linhasParametro(relatorio).reduce((total, { parametro }) => total + parametro.periodos.length, 0);
}

/**
 * Linhas do CSV: uma por período de cada parâmetro de cada estação, em ISO 8601
 * (UTC), seguidas dos totalizadores, cujo período é o intervalo ISO 8601
 * "início/fim" da consulta. Números arredondados como na tela, sem unidade.
 */
export function linhasCsvHistorico(relatorio: HistoricoClimaticoRespostaDto): unknown[][] {
  const linhas = linhasParametro(relatorio);
  const intervalo = `${relatorio.de}/${relatorio.ate}`;
  const linha = ({ estacaoNome, parametro }: LinhaParametro, periodo: string, estatisticas: EstatisticasHistoricoDto) => [
    periodo,
    estacaoNome,
    parametro.nome,
    parametro.unidade,
    nomeAgregacao(parametro.agregacao),
    arredondar(estatisticas.valor),
    arredondar(estatisticas.soma),
    arredondar(estatisticas.media),
    arredondar(estatisticas.minimo),
    arredondar(estatisticas.maximo),
    estatisticas.leituras,
  ];

  return [
    ...linhas.flatMap((item) => item.parametro.periodos.map((estatisticas) => linha(item, estatisticas.periodo ?? '', estatisticas))),
    ...linhas.map((item) => linha(item, intervalo, item.parametro.totalPeriodo)),
  ];
}

export function nomeArquivoHistorico(relatorio: HistoricoClimaticoRespostaDto, extensao: 'csv' | 'pdf'): string {
  return `historico-climatico_${relatorio.de.slice(0, 10)}_${relatorio.ate.slice(0, 10)}.${extensao}`;
}

export function filtrosHistorico(relatorio: HistoricoClimaticoRespostaDto, filtros: FiltrosExportacaoHistorico): FiltroRelatorio[] {
  const comDados = relatorio.estacoes.filter((estacao) => estacao.parametros.length > 0);
  const nomes = comDados.map((estacao) => estacao.nome).join(', ');
  let estacoes: string;
  if (!filtros.estacaoIds.length) {
    estacoes = comDados.length ? `Todas (com leituras: ${nomes})` : 'Todas';
  } else {
    const resumo = `${filtros.estacaoIds.length} selecionada(s), ${comDados.length} com leituras`;
    estacoes = comDados.length ? `${nomes} (${resumo})` : resumo;
  }

  return [
    { rotulo: 'Período', valor: `${dataHoraUtc(relatorio.de)} a ${dataHoraUtc(relatorio.ate)} (UTC)` },
    { rotulo: 'Granularidade', valor: relatorio.granularidade === 'hora' ? 'Hora' : 'Dia' },
    { rotulo: 'Estações', valor: estacoes },
  ];
}

export function documentoPdfHistorico(
  relatorio: HistoricoClimaticoRespostaDto,
  filtros: FiltrosExportacaoHistorico,
  emissao: EmissaoRelatorio = {},
): TDocumentDefinitions {
  const linhas = linhasParametro(relatorio);
  const totalPeriodos = totalLinhasPeriodo(relatorio);
  const porPeriodo = relatorio.granularidade === 'hora' ? 'Dados por hora' : 'Dados por dia';

  const conteudo: Content[] = linhas.length
    ? [
        ...graficosPorParametro(relatorio),
        secaoPdf('Totalizadores do período'),
        tabelaPdf(
          ['Estação', 'Parâmetro', ...COLUNAS_ESTATISTICAS],
          linhas.map(({ estacaoNome, parametro }) => [estacaoNome, parametro.nome, ...celulasEstatisticas(parametro, parametro.totalPeriodo)]),
          { larguras: ['*', '*', 52, 70, 70, 70, 70, 70, 50], colunasNumero: [3, 4, 5, 6, 7, 8] },
        ),
        secaoPdf(porPeriodo),
        totalPeriodos > LIMITE_LINHAS_TABELA_PDF
          ? {
              text: `A consulta tem ${totalPeriodos.toLocaleString('pt-BR')} linhas por período, acima do limite de ${LIMITE_LINHAS_TABELA_PDF.toLocaleString('pt-BR')} do PDF. Exporte em CSV para ter a tabela completa ou reduza o período.`,
              italics: true,
            }
          : tabelaPdf(
              ['Período', 'Estação', 'Parâmetro', ...COLUNAS_ESTATISTICAS],
              linhas.flatMap(({ estacaoNome, parametro }) =>
                parametro.periodos.map((estatisticas) => [
                  rotuloPeriodo(estatisticas.periodo ?? '', relatorio.granularidade),
                  estacaoNome,
                  parametro.nome,
                  ...celulasEstatisticas(parametro, estatisticas),
                ]),
              ),
              { larguras: [58, '*', '*', 52, 64, 64, 64, 64, 64, 46], colunasNumero: [4, 5, 6, 7, 8, 9] },
            ),
      ]
    : [{ text: 'Nenhuma leitura encontrada para os filtros informados.', margin: [0, 12, 0, 0] }];

  return montarRelatorioPdf({
    titulo: 'Relatório de histórico climático',
    subtitulo: 'Comportamento das variáveis climáticas por período e estação',
    instituicao: emissao.instituicao,
    filtros: filtrosHistorico(relatorio, filtros),
    conteudo,
    emitidoEm: emissao.emitidoEm,
    emitidoPor: emissao.emitidoPor,
    orientacao: 'landscape',
  });
}

/**
 * Um gráfico por parâmetro, uma linha por estação, com o valor consolidado de
 * cada período, como na tela. Estação sem leitura num período fica sem ponto
 * ali e a linha liga os vizinhos, também como na tela.
 */
function graficosPorParametro(relatorio: HistoricoClimaticoRespostaDto): Content[] {
  const parametros = new Map<string, LinhaParametro[]>();
  for (const linha of linhasParametro(relatorio)) {
    parametros.set(linha.parametro.id, [...(parametros.get(linha.parametro.id) ?? []), linha]);
  }

  return [...parametros.values()].flatMap((doParametro) => {
    const { nome, unidade, agregacao } = doParametro[0].parametro;
    const periodos = [...new Set(doParametro.flatMap(({ parametro }) => parametro.periodos.map((item) => item.periodo ?? '')))]
      .filter(Boolean)
      .sort();

    const series: SerieGrafico[] = doParametro.map(({ estacaoNome, parametro }) => {
      const valores = new Map(parametro.periodos.map((item) => [item.periodo, item.valor]));
      return {
        nome: estacaoNome,
        pontos: periodos.map((periodo) => ({
          rotulo: rotuloPeriodo(periodo, relatorio.granularidade),
          valor: valores.get(periodo) ?? null,
        })),
      };
    });

    return [
      secaoPdf(`${nome} (${unidade}) · ${agregacao === 'SOMA' ? 'soma' : 'média'} por ${relatorio.granularidade}`),
      { svg: graficoLinhasSvg(series, LARGURA_PDF) },
    ] as Content[];
  });
}

function celulasEstatisticas(parametro: ParametroHistoricoClimaticoDto, estatisticas: EstatisticasHistoricoDto): string[] {
  const { unidade } = parametro;
  return [
    nomeAgregacao(parametro.agregacao),
    comUnidade(estatisticas.valor, unidade),
    comUnidade(estatisticas.soma, unidade),
    comUnidade(estatisticas.media, unidade),
    comUnidade(estatisticas.minimo, unidade),
    comUnidade(estatisticas.maximo, unidade),
    estatisticas.leituras.toLocaleString('pt-BR'),
  ];
}

function nomeAgregacao(agregacao: 'SOMA' | 'MEDIA'): string {
  return agregacao === 'SOMA' ? 'Soma' : 'Média';
}

function arredondar(valor: number): number {
  return Math.round(valor * 100) / 100;
}

/** Duas casas fixas, como a tela. */
function comUnidade(valor: number, unidade: string): string {
  return `${valor.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${unidade}`;
}

/** O endpoint agrega em UTC e a tela rotula em UTC: o PDF segue o mesmo fuso. */
function partesUtc(iso: string): Record<string, string> {
  const formatador = new Intl.DateTimeFormat('pt-BR', {
    timeZone: 'UTC',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  });
  return Object.fromEntries(formatador.formatToParts(new Date(iso)).map((parte) => [parte.type, parte.value]));
}

function rotuloPeriodo(iso: string, granularidade: string): string {
  const { day, month, year, hour } = partesUtc(iso);
  return granularidade === 'dia' ? `${day}/${month}/${year}` : `${day}/${month} ${hour}h`;
}

function dataHoraUtc(iso: string): string {
  const { day, month, year, hour, minute } = partesUtc(iso);
  return `${day}/${month}/${year} ${hour}:${minute}`;
}
