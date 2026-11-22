import type { Content, ContentSvg, ContentTable } from 'pdfmake/interfaces';
import { gerarPdf } from '../../../src/exportacao/pdf';
import type {
  EstatisticasHistoricoDto,
  HistoricoClimaticoRespostaDto,
  ParametroHistoricoClimaticoDto,
} from '../../../src/relatorios/dto/historico-climatico-resposta.dto';
import {
  CABECALHO_CSV_HISTORICO,
  LIMITE_LINHAS_TABELA_PDF,
  documentoPdfHistorico,
  filtrosHistorico,
  linhasCsvHistorico,
  nomeArquivoHistorico,
  totalLinhasPeriodo,
} from '../../../src/relatorios/historico-climatico-exportacao';

const DIA_1 = '2026-10-01T00:00:00.000Z';
const DIA_2 = '2026-10-02T00:00:00.000Z';

function estatisticas(parcial: Partial<EstatisticasHistoricoDto>): EstatisticasHistoricoDto {
  return { agregacao: 'SOMA', valor: 12.345, soma: 12.345, media: 1.234, minimo: 0, maximo: 5, leituras: 10, ...parcial };
}

function chuva(periodos: EstatisticasHistoricoDto[], total: Partial<EstatisticasHistoricoDto> = {}): ParametroHistoricoClimaticoDto {
  return { id: 'chuva', nome: 'Precipitação', unidade: 'mm', agregacao: 'SOMA', periodos, totalPeriodo: estatisticas(total) };
}

const TEMPERATURA: ParametroHistoricoClimaticoDto = {
  id: 'temp',
  nome: 'Temperatura',
  unidade: '°C',
  agregacao: 'MEDIA',
  periodos: [estatisticas({ periodo: DIA_1, agregacao: 'MEDIA', valor: 21.5, soma: 215, media: 21.5, minimo: 18, maximo: 25 })],
  totalPeriodo: estatisticas({ agregacao: 'MEDIA', valor: 21.5, soma: 215, media: 21.5, minimo: 18, maximo: 25 }),
};

// Formato de GET /relatorios/historico-climatico (SCRUM-54): o mesmo que a tela recebe.
const RELATORIO: HistoricoClimaticoRespostaDto = {
  de: DIA_1,
  ate: '2026-10-02T23:59:59.999Z',
  granularidade: 'dia',
  estacoes: [
    {
      id: 'e1',
      nome: 'Centro',
      parametros: [
        chuva([estatisticas({ periodo: DIA_1 }), estatisticas({ periodo: DIA_2, valor: 3, soma: 3 })], { valor: 15.345, soma: 15.345 }),
        TEMPERATURA,
      ],
    },
    { id: 'e2', nome: 'Norte', parametros: [chuva([estatisticas({ periodo: DIA_1, valor: 7, soma: 7 })], { valor: 7, soma: 7 })] },
  ],
};

const TODAS = { estacaoIds: [] };

function textoDe(conteudo: unknown): string {
  return JSON.stringify(conteudo);
}

function tabelas(documento: { content: unknown }): ContentTable[] {
  return (documento.content as Content[]).filter((item) => (item as ContentTable).table) as ContentTable[];
}

describe('Exportação do relatório de histórico climático', () => {
  it('CSV tem as colunas da tabela da tela, período em ISO 8601 e números puros', () => {
    expect(CABECALHO_CSV_HISTORICO).toEqual([
      'Período', 'Estação', 'Parâmetro', 'Unidade', 'Agregação', 'Consolidado', 'Soma', 'Média', 'Mínimo', 'Máximo', 'Leituras',
    ]);

    const linhas = linhasCsvHistorico(RELATORIO);
    // 4 períodos + 3 totalizadores (um por estação e parâmetro).
    expect(linhas).toHaveLength(7);
    expect(linhas[0]).toEqual([DIA_1, 'Centro', 'Precipitação', 'mm', 'Soma', 12.35, 12.35, 1.23, 0, 5, 10]);
    expect(linhas[2]).toEqual([DIA_1, 'Centro', 'Temperatura', '°C', 'Média', 21.5, 215, 21.5, 18, 25, 10]);
  });

  it('CSV fecha com os totalizadores, cujo período é o intervalo ISO 8601 da consulta', () => {
    const totais = linhasCsvHistorico(RELATORIO).slice(4);
    expect(totais.map((linha) => linha[0])).toEqual(Array(3).fill('2026-10-01T00:00:00.000Z/2026-10-02T23:59:59.999Z'));
    expect(totais[0].slice(1, 6)).toEqual(['Centro', 'Precipitação', 'mm', 'Soma', 15.35]);
    expect(totais[2].slice(1, 6)).toEqual(['Norte', 'Precipitação', 'mm', 'Soma', 7]);
  });

  it('conta as linhas por período sem os totais', () => {
    expect(totalLinhasPeriodo(RELATORIO)).toBe(4);
  });

  it('nomeia o arquivo pelas datas UTC da consulta', () => {
    expect(nomeArquivoHistorico(RELATORIO, 'csv')).toBe('historico-climatico_2026-10-01_2026-10-02.csv');
    expect(nomeArquivoHistorico(RELATORIO, 'pdf')).toBe('historico-climatico_2026-10-01_2026-10-02.pdf');
  });

  it('lista os filtros usados em UTC, como a tela', () => {
    expect(filtrosHistorico(RELATORIO, TODAS)).toEqual([
      { rotulo: 'Período', valor: '01/10/2026 00:00 a 02/10/2026 23:59 (UTC)' },
      { rotulo: 'Granularidade', valor: 'Dia' },
      { rotulo: 'Estações', valor: 'Todas (com leituras: Centro, Norte)' },
    ]);
  });

  it('diz quantas estações foram pedidas e quantas tinham leitura', () => {
    const [, , estacoes] = filtrosHistorico(RELATORIO, { estacaoIds: ['e1', 'e2', 'e3'] });
    expect(estacoes.valor).toBe('Centro, Norte (3 selecionada(s), 2 com leituras)');
    const [, , semDados] = filtrosHistorico({ ...RELATORIO, estacoes: [] }, { estacaoIds: ['e3'] });
    expect(semDados.valor).toBe('1 selecionada(s), 0 com leituras');
  });

  it('PDF traz filtros, um gráfico por parâmetro, totalizadores e a tabela por período', () => {
    const documento = documentoPdfHistorico(RELATORIO, TODAS, { emitidoPor: 'Ana', instituicao: 'PE-001/2026' });
    const texto = textoDe(documento.content);

    expect(documento.pageOrientation).toBe('landscape');
    expect(texto).toContain('Relatório de histórico climático');
    expect(texto).toContain('01/10/2026 00:00 a 02/10/2026 23:59 (UTC)');
    expect(texto).toContain('Precipitação (mm) · soma por dia');
    expect(texto).toContain('Temperatura (°C) · média por dia');
    expect((documento.content as Content[]).filter((item) => (item as ContentSvg).svg)).toHaveLength(2);

    // Filtros, totalizadores e dados por período.
    const [, totais, dados] = tabelas(documento);
    expect(totais.table.body[0].map((celula) => (celula as { text: string }).text)).toEqual([
      'Estação', 'Parâmetro', 'Agregação', 'Consolidado', 'Soma', 'Média', 'Mínimo', 'Máximo', 'Leituras',
    ]);
    expect(totais.table.body[1][3]).toMatchObject({ text: '15,35 mm' });
    expect(dados.table.body).toHaveLength(1 + 4);
    expect(dados.table.body[1][0]).toMatchObject({ text: '01/10/2026' });
    expect(dados.table.body[1][4]).toMatchObject({ text: '12,35 mm' });
    expect(dados.table.body[3][4]).toMatchObject({ text: '21,50 °C' });
  });

  it('gráfico deixa sem ponto a estação sem leitura no período, sem zerar', () => {
    const documento = documentoPdfHistorico(RELATORIO, TODAS);
    const svg = (documento.content as Content[]).find((item) => (item as ContentSvg).svg) as ContentSvg;
    // Centro tem os dois dias (linha); Norte só o dia 1 (marcador).
    expect((svg.svg as string).match(/<polyline/g)).toHaveLength(1);
    expect((svg.svg as string).match(/<circle/g)).toHaveLength(1);
    expect(svg.svg).not.toContain('NaN');
  });

  it('PDF sem leituras avisa em vez de gerar gráfico e tabelas vazios', () => {
    const texto = textoDe(documentoPdfHistorico({ ...RELATORIO, estacoes: [] }, TODAS).content);
    expect(texto).toContain('Nenhuma leitura encontrada para os filtros informados.');
    expect(texto).not.toContain('Totalizadores do período');
  });

  it('acima do limite, o PDF tira a tabela por período e manda para o CSV', () => {
    const periodos = Array.from({ length: LIMITE_LINHAS_TABELA_PDF + 1 }, (_, hora) =>
      estatisticas({ periodo: new Date(Date.parse(DIA_1) + hora * 3_600_000).toISOString() }),
    );
    const documento = documentoPdfHistorico(
      { ...RELATORIO, granularidade: 'hora', estacoes: [{ id: 'e1', nome: 'Centro', parametros: [chuva(periodos)] }] },
      TODAS,
    );
    // Só filtros e totalizadores.
    expect(tabelas(documento)).toHaveLength(2);
    expect(textoDe(documento.content)).toContain('Exporte em CSV para ter a tabela completa');
  });

  it('granularidade por hora rotula o período com dia e hora UTC', () => {
    const documento = documentoPdfHistorico(
      {
        ...RELATORIO,
        granularidade: 'hora',
        estacoes: [{ id: 'e1', nome: 'Centro', parametros: [chuva([estatisticas({ periodo: '2026-10-01T17:00:00.000Z' })])] }],
      },
      TODAS,
    );
    expect(tabelas(documento)[2].table.body[1][0]).toMatchObject({ text: '01/10 17h' });
    expect(textoDe(documento.content)).toContain('Dados por hora');
  });

  it('gera um PDF válido', async () => {
    const conteudo = await gerarPdf(documentoPdfHistorico(RELATORIO, TODAS, { emitidoEm: new Date(DIA_2) }));
    expect(conteudo.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
