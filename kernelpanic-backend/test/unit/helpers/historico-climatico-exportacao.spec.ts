import type { Content, ContentSvg, ContentTable } from 'pdfmake/interfaces';
import { gerarPdf } from '../../../src/exportacao/pdf';
import {
  CABECALHO_CSV_HISTORICO,
  documentoPdfHistorico,
  filtrosHistorico,
  linhasCsvHistorico,
  nomeArquivoHistorico,
  type LinhaHistoricoClimatico,
  type RelatorioHistoricoClimatico,
  type TotalHistoricoClimatico,
} from '../../../src/relatorios/historico-climatico-exportacao';

// Dias no horário de Brasília: 01/10 00:00 BRT = 01/10 03:00 UTC.
const DIA_1 = new Date('2026-10-01T03:00:00.000Z');
const DIA_2 = new Date('2026-10-02T03:00:00.000Z');

function linha(parcial: Partial<LinhaHistoricoClimatico>): LinhaHistoricoClimatico {
  return {
    periodo: DIA_1,
    estacaoId: 'e1',
    estacaoNome: 'Centro',
    parametroId: 'chuva',
    parametroNome: 'Precipitação',
    unidade: 'mm',
    agregacao: 'SOMA',
    minimo: 0,
    maximo: 5,
    media: 1.234,
    acumulado: 12.345,
    ...parcial,
  };
}

function total(parcial: Partial<LinhaHistoricoClimatico>): TotalHistoricoClimatico {
  const { periodo: _periodo, ...resto } = linha(parcial);
  return resto;
}

const RELATORIO: RelatorioHistoricoClimatico = {
  filtros: {
    de: DIA_1,
    ate: new Date('2026-10-03T02:59:59.999Z'),
    granularidade: 'dia',
    estacoes: [{ id: 'e1', nome: 'Centro' }, { id: 'e2', nome: 'Norte' }],
  },
  linhas: [
    linha({}),
    linha({ periodo: DIA_2, acumulado: 3 }),
    linha({ estacaoId: 'e2', estacaoNome: 'Norte', acumulado: 7 }),
    linha({ parametroId: 'temp', parametroNome: 'Temperatura', unidade: '°C', agregacao: 'MEDIA', media: 21.5, acumulado: null }),
  ],
  totais: [
    total({ acumulado: 15.345 }),
    total({ estacaoId: 'e2', estacaoNome: 'Norte', acumulado: 7 }),
  ],
};

function textoDe(conteudo: unknown): string {
  return JSON.stringify(conteudo);
}

describe('Exportação do relatório de histórico climático', () => {
  it('CSV tem as colunas da tabela, período em ISO 8601 e números puros', () => {
    expect(CABECALHO_CSV_HISTORICO).toEqual(['Período', 'Estação', 'Parâmetro', 'Unidade', 'Mínimo', 'Máximo', 'Média', 'Acumulado']);

    const linhas = linhasCsvHistorico(RELATORIO);
    expect(linhas).toHaveLength(4);
    expect(linhas[0]).toEqual(['2026-10-01T03:00:00.000Z', 'Centro', 'Precipitação', 'mm', 0, 5, 1.23, 12.35]);
    // Parâmetro de MEDIA não tem acumulado: célula vazia, não zero.
    expect(linhas[3][7]).toBeNull();
  });

  it('nomeia o arquivo pelo período no horário de Brasília', () => {
    expect(nomeArquivoHistorico(RELATORIO, 'csv')).toBe('historico-climatico_2026-10-01_2026-10-02.csv');
    expect(nomeArquivoHistorico(RELATORIO, 'pdf')).toBe('historico-climatico_2026-10-01_2026-10-02.pdf');
  });

  it('lista os filtros usados no horário de Brasília', () => {
    expect(filtrosHistorico(RELATORIO)).toEqual([
      { rotulo: 'Período', valor: '01/10/2026 00:00 a 02/10/2026 23:59 (horário de Brasília)' },
      { rotulo: 'Granularidade', valor: 'Dia' },
      { rotulo: 'Estações', valor: 'Centro, Norte' },
    ]);
  });

  it('PDF traz filtros, um gráfico por parâmetro, totalizadores e a tabela', () => {
    const documento = documentoPdfHistorico(RELATORIO, { emitidoPor: 'Ana', instituicao: 'PE-001/2026' });
    const conteudo = documento.content as Content[];
    const texto = textoDe(conteudo);

    expect(texto).toContain('Relatório de histórico climático');
    expect(texto).toContain('01/10/2026 00:00 a 02/10/2026 23:59');
    expect(texto).toContain('Precipitação (mm) · acumulado por dia');
    expect(texto).toContain('Temperatura (°C) · média por dia');
    expect(conteudo.filter((item) => (item as ContentSvg).svg)).toHaveLength(2);
    expect(texto).toContain('Totalizadores do período');

    const tabelas = conteudo.filter((item) => (item as ContentTable).table) as ContentTable[];
    // Filtros, totalizadores e dados.
    expect(tabelas).toHaveLength(3);
    const dados = tabelas[2].table.body;
    expect(dados).toHaveLength(1 + RELATORIO.linhas.length);
    expect(dados[1][0]).toMatchObject({ text: '01/10/2026' });
    expect(dados[1][6]).toMatchObject({ text: '12,35 mm' });
    expect(dados[4][6]).toMatchObject({ text: '—' });
  });

  it('gráfico de SOMA põe 0 quando a estação não teve leitura no período', () => {
    const documento = documentoPdfHistorico({ ...RELATORIO, linhas: RELATORIO.linhas.slice(0, 3) });
    const svg = (documento.content as Content[]).find((item) => (item as ContentSvg).svg) as ContentSvg;
    // Norte só tem o dia 1: a série dela tem 2 pontos, o segundo em 0.
    expect((svg.svg as string).match(/<polyline/g)).toHaveLength(2);
    expect(svg.svg).not.toContain('NaN');
  });

  it('PDF sem leituras avisa em vez de gerar gráfico e tabela vazios', () => {
    const texto = textoDe(documentoPdfHistorico({ ...RELATORIO, linhas: [], totais: [] }).content);
    expect(texto).toContain('Nenhuma leitura encontrada para os filtros informados.');
    expect(texto).not.toContain('Totalizadores do período');
  });

  it('granularidade por hora rotula o período com dia e hora', () => {
    const documento = documentoPdfHistorico({
      ...RELATORIO,
      filtros: { ...RELATORIO.filtros, granularidade: 'hora' },
      linhas: [linha({ periodo: new Date('2026-10-01T17:00:00.000Z') })],
    });
    const tabelas = (documento.content as Content[]).filter((item) => (item as ContentTable).table) as ContentTable[];
    expect(tabelas[2].table.body[1][0]).toMatchObject({ text: '01/10 14h' });
    expect(textoDe(documento.content)).toContain('Dados por hora');
  });

  it('gera um PDF válido', async () => {
    const conteudo = await gerarPdf(documentoPdfHistorico(RELATORIO, { emitidoEm: DIA_2 }));
    expect(conteudo.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
