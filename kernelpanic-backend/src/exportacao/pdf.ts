import { dirname, join } from 'node:path';
import type { Response } from 'express';
import pdfmake from 'pdfmake';
import type { Alignment, Content, TableCell, TDocumentDefinitions } from 'pdfmake/interfaces';

// Layout base dos relatórios em PDF (US09, US10 e US11). A decisão de gerar no
// backend com pdfmake está em docs/decisao-pdf-relatorios.md.

const PASTA_FONTES = join(dirname(require.resolve('pdfmake/fonts/Roboto')), 'Roboto');

pdfmake.setFonts({
  Roboto: {
    normal: join(PASTA_FONTES, 'Roboto-Regular.ttf'),
    bold: join(PASTA_FONTES, 'Roboto-Medium.ttf'),
    italics: join(PASTA_FONTES, 'Roboto-Italic.ttf'),
    bolditalics: join(PASTA_FONTES, 'Roboto-MediumItalic.ttf'),
  },
});
// O PDF é montado só com dados nossos: nada de buscar URL nem ler arquivo fora das fontes.
pdfmake.setUrlAccessPolicy(() => false);
pdfmake.setLocalAccessPolicy((caminho) => caminho.startsWith(PASTA_FONTES));

/** Mesmas cores da planilha exportada pela tela (frontend/frontend/lib/baixar-planilha.ts). */
export const CORES_PDF = {
  primaria: '#123B3A',
  destaque: '#0F766E',
  texto: '#0F172A',
  suave: '#475569',
  borda: '#CBD5E1',
  zebra: '#F1F5F9',
  serie: ['#0891B2', '#65A30D', '#EA580C', '#7C3AED', '#DB2777', '#0284C7'],
} as const;

const FUSO = 'America/Sao_Paulo';

export interface FiltroRelatorio {
  rotulo: string;
  valor: string;
}

export interface OpcoesRelatorioPdf {
  titulo: string;
  subtitulo?: string;
  /** Licitação ou órgão do usuário, exibido à direita do cabeçalho. */
  instituicao?: string;
  /** Filtros usados na consulta: o PDF precisa dizer de onde vieram os números. */
  filtros: FiltroRelatorio[];
  conteudo: Content[];
  emitidoEm?: Date;
  emitidoPor?: string;
  orientacao?: 'portrait' | 'landscape';
}

/** Data e hora no horário de Brasília, com o fuso explícito no texto. */
export function formatarDataHora(data: Date): string {
  const texto = data.toLocaleString('pt-BR', {
    timeZone: FUSO,
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
  return `${texto} (horário de Brasília)`;
}

export function montarRelatorioPdf(opcoes: OpcoesRelatorioPdf): TDocumentDefinitions {
  const emitidoEm = opcoes.emitidoEm ?? new Date();
  const emissao = `Emitido em ${formatarDataHora(emitidoEm)}${opcoes.emitidoPor ? ` por ${opcoes.emitidoPor}` : ''}`;

  return {
    pageSize: 'A4',
    pageOrientation: opcoes.orientacao ?? 'portrait',
    pageMargins: [40, 64, 40, 52],
    info: { title: opcoes.titulo, author: 'Data Panic', creator: 'Data Panic', producer: 'Data Panic' },
    defaultStyle: { font: 'Roboto', fontSize: 9, color: CORES_PDF.texto },
    styles: {
      titulo: { fontSize: 16, bold: true, color: CORES_PDF.primaria },
      subtitulo: { fontSize: 10, color: CORES_PDF.suave },
      secao: { fontSize: 11, bold: true, color: CORES_PDF.primaria, margin: [0, 12, 0, 6] },
      cabecalhoTabela: { bold: true, color: '#FFFFFF', fillColor: CORES_PDF.primaria },
    },
    header: (_paginaAtual, _totalPaginas, tamanho) => ({
      margin: [40, 24, 40, 0],
      stack: [
        {
          columns: [
            { text: 'DATA PANIC', bold: true, fontSize: 11, color: CORES_PDF.primaria },
            { text: 'Monitoramento e alertas de desastres naturais', fontSize: 8, color: CORES_PDF.suave, margin: [0, 2, 0, 0] },
            { text: opcoes.instituicao ?? '', alignment: 'right', fontSize: 8, color: CORES_PDF.suave, margin: [0, 2, 0, 0] },
          ],
        },
        {
          canvas: [{ type: 'line', x1: 0, y1: 6, x2: tamanho.width - 80, y2: 6, lineWidth: 1.5, lineColor: CORES_PDF.destaque }],
        },
      ],
    }),
    footer: (paginaAtual, totalPaginas) => ({
      margin: [40, 16, 40, 0],
      columns: [
        { text: emissao, fontSize: 7, color: CORES_PDF.suave },
        { text: `Página ${paginaAtual} de ${totalPaginas}`, alignment: 'right', fontSize: 7, color: CORES_PDF.suave },
      ],
    }),
    content: [
      { text: opcoes.titulo, style: 'titulo' },
      ...(opcoes.subtitulo ? [{ text: opcoes.subtitulo, style: 'subtitulo', margin: [0, 2, 0, 0] } as Content] : []),
      blocoFiltros(opcoes.filtros),
      ...opcoes.conteudo,
    ],
  };
}

function blocoFiltros(filtros: FiltroRelatorio[]): Content {
  const linhas: TableCell[][] = filtros.length
    ? filtros.map((filtro) => [
        { text: filtro.rotulo, bold: true, color: CORES_PDF.suave },
        { text: filtro.valor },
      ])
    : [[{ text: 'Sem filtros', colSpan: 2, color: CORES_PDF.suave }, {}]];

  return {
    margin: [0, 12, 0, 4],
    table: { widths: [110, '*'], body: [[{ text: 'Filtros usados', style: 'cabecalhoTabela', colSpan: 2 }, {}], ...linhas] },
    layout: layoutTabela(),
  };
}

export interface OpcoesTabelaPdf {
  /** Larguras das colunas no formato do pdfmake ('*', 'auto' ou número). */
  larguras?: (string | number)[];
  /** Índices das colunas numéricas, alinhadas à direita. */
  colunasNumero?: number[];
  /** Linhas finais em negrito (totalizadores). */
  linhasTotal?: number;
}

/** Tabela no padrão dos relatórios: cabeçalho repetido a cada página e linhas zebradas. */
export function tabelaPdf(cabecalhos: string[], linhas: unknown[][], opcoes: OpcoesTabelaPdf = {}): Content {
  const numericas = new Set(opcoes.colunasNumero ?? []);
  const inicioTotal = linhas.length - (opcoes.linhasTotal ?? 0);
  const alinhar = (indice: number): Alignment => (numericas.has(indice) ? 'right' : 'left');

  return {
    table: {
      headerRows: 1,
      dontBreakRows: true,
      widths: opcoes.larguras ?? cabecalhos.map(() => '*'),
      body: [
        cabecalhos.map((texto, indice): TableCell => ({ text: texto, style: 'cabecalhoTabela', alignment: alinhar(indice) })),
        ...linhas.map((linha, indiceLinha) =>
          linha.map((valor, indice): TableCell => ({
            text: textoCelula(valor),
            alignment: alinhar(indice),
            bold: indiceLinha >= inicioTotal,
          })),
        ),
      ],
    },
    layout: layoutTabela(),
  };
}

function textoCelula(valor: unknown): string {
  if (valor === null || valor === undefined) return '—';
  if (valor instanceof Date) return formatarDataHora(valor);
  if (typeof valor === 'number') return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
  return String(valor);
}

function layoutTabela() {
  return {
    hLineWidth: () => 0.5,
    vLineWidth: () => 0,
    hLineColor: () => CORES_PDF.borda,
    fillColor: (linha: number) => (linha > 0 && linha % 2 === 0 ? CORES_PDF.zebra : null),
    paddingTop: () => 4,
    paddingBottom: () => 4,
  };
}

export interface SerieGrafico {
  nome: string;
  pontos: { rotulo: string; valor: number }[];
}

/**
 * Gráfico de linhas em SVG, desenhado pelo pdfmake como vetor. Os pontos de
 * todas as séries devem usar os mesmos rótulos no eixo X, na mesma ordem.
 */
export function graficoLinhasSvg(series: SerieGrafico[], largura = 515, altura = 200): string {
  const margem = { esquerda: 44, direita: 8, topo: 8, base: 36 };
  const areaL = largura - margem.esquerda - margem.direita;
  const areaA = altura - margem.topo - margem.base;
  const rotulos = series[0]?.pontos.map((ponto) => ponto.rotulo) ?? [];
  const valores = series.flatMap((serie) => serie.pontos.map((ponto) => ponto.valor));
  const minimo = valores.length ? Math.min(0, ...valores) : 0;
  const maximo = valores.length ? Math.max(...valores) : 1;
  const faixa = maximo - minimo || 1;
  const x = (indice: number) => margem.esquerda + (rotulos.length > 1 ? (indice / (rotulos.length - 1)) * areaL : areaL / 2);
  const y = (valor: number) => margem.topo + areaA - ((valor - minimo) / faixa) * areaA;
  const numero = (valor: number) => valor.toLocaleString('pt-BR', { maximumFractionDigits: 1 });

  const grade = [0, 0.25, 0.5, 0.75, 1].map((fracao) => {
    const valor = minimo + faixa * fracao;
    const posicao = y(valor).toFixed(1);
    return `<line x1="${margem.esquerda}" y1="${posicao}" x2="${largura - margem.direita}" y2="${posicao}" stroke="${CORES_PDF.borda}" stroke-width="0.5"/>`
      + `<text x="${margem.esquerda - 4}" y="${posicao}" font-size="7" fill="${CORES_PDF.suave}" text-anchor="end">${numero(valor)}</text>`;
  });
  // Até 8 rótulos no eixo X para não sobrepor.
  const passo = Math.max(1, Math.ceil(rotulos.length / 8));
  const eixoX = rotulos
    .map((rotulo, indice) => (indice % passo === 0
      ? `<text x="${x(indice).toFixed(1)}" y="${altura - margem.base + 12}" font-size="7" fill="${CORES_PDF.suave}" text-anchor="middle">${escaparXml(rotulo)}</text>`
      : ''))
    .join('');
  const linhas = series.map((serie, indice) => {
    const cor = CORES_PDF.serie[indice % CORES_PDF.serie.length];
    const pontos = serie.pontos.map((ponto, i) => `${x(i).toFixed(1)},${y(ponto.valor).toFixed(1)}`).join(' ');
    return `<polyline points="${pontos}" fill="none" stroke="${cor}" stroke-width="1.5"/>`;
  });
  const legenda = series.map((serie, indice) => {
    const cor = CORES_PDF.serie[indice % CORES_PDF.serie.length];
    const posicao = margem.esquerda + indice * 120;
    return `<rect x="${posicao}" y="${altura - 10}" width="8" height="8" fill="${cor}"/>`
      + `<text x="${posicao + 12}" y="${altura - 3}" font-size="7" fill="${CORES_PDF.texto}">${escaparXml(serie.nome)}</text>`;
  });

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${largura}" height="${altura}" viewBox="0 0 ${largura} ${altura}">`
    + `${grade.join('')}${eixoX}${linhas.join('')}${legenda.join('')}</svg>`;
}

function escaparXml(texto: string): string {
  return texto.replace(/[<>&"']/g, (caractere) => `&#${caractere.charCodeAt(0)};`);
}

export function gerarPdf(documento: TDocumentDefinitions): Promise<Buffer> {
  return pdfmake.createPdf(documento).getBuffer();
}

/** Gera o PDF inteiro antes de responder: um erro na montagem ainda sai como JSON. */
export async function enviarPdf(resposta: Response, nomeArquivo: string, documento: TDocumentDefinitions): Promise<void> {
  const conteudo = await gerarPdf(documento);
  resposta.setHeader('Content-Type', 'application/pdf');
  resposta.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  resposta.setHeader('Cache-Control', 'no-store');
  resposta.setHeader('Content-Length', conteudo.length);
  resposta.end(conteudo);
}
