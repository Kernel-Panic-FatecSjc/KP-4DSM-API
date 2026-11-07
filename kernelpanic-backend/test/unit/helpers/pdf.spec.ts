import type { Response } from 'express';
import type { Content, ContentTable, DynamicContent } from 'pdfmake/interfaces';
import {
  enviarPdf,
  formatarDataHora,
  gerarPdf,
  graficoLinhasSvg,
  montarRelatorioPdf,
  tabelaPdf,
} from '../../../src/exportacao/pdf';

const EMISSAO = new Date('2026-11-07T18:30:00.000Z');
const TAMANHO_A4 = { width: 595.28, height: 841.89, orientation: 'portrait' as const };

function texto(conteudo: unknown): string {
  return JSON.stringify(conteudo);
}

describe('PDF dos relatórios', () => {
  it('formata a emissão no horário de Brasília, com o fuso no texto', () => {
    expect(formatarDataHora(EMISSAO)).toBe('07/11/2026, 15:30 (horário de Brasília)');
  });

  it('monta cabeçalho, título, filtros e rodapé com emissão e paginação', () => {
    const documento = montarRelatorioPdf({
      titulo: 'Histórico climático',
      subtitulo: 'Relatório 1',
      instituicao: 'PE-001/2026',
      filtros: [{ rotulo: 'Período', valor: '01/10/2026 a 14/10/2026' }],
      conteudo: [{ text: 'corpo' }],
      emitidoEm: EMISSAO,
      emitidoPor: 'Ana',
    });

    const cabecalho = (documento.header as DynamicContent)(1, 3, TAMANHO_A4);
    expect(texto(cabecalho)).toContain('DATA PANIC');
    expect(texto(cabecalho)).toContain('PE-001/2026');

    const rodape = (documento.footer as DynamicContent)(2, 3, TAMANHO_A4);
    expect(texto(rodape)).toContain('Página 2 de 3');
    expect(texto(rodape)).toContain('Emitido em 07/11/2026, 15:30 (horário de Brasília) por Ana');

    const conteudo = documento.content as Content[];
    expect(conteudo[0]).toMatchObject({ text: 'Histórico climático', style: 'titulo' });
    expect(conteudo[1]).toMatchObject({ text: 'Relatório 1' });
    expect(texto(conteudo[2])).toContain('Filtros usados');
    expect(texto(conteudo[2])).toContain('01/10/2026 a 14/10/2026');
    expect(conteudo.at(-1)).toEqual({ text: 'corpo' });
    expect(documento.info?.title).toBe('Histórico climático');
  });

  it('avisa quando o relatório não tem filtros', () => {
    const documento = montarRelatorioPdf({ titulo: 'T', filtros: [], conteudo: [] });
    expect(texto(documento.content)).toContain('Sem filtros');
  });

  it('repete o cabeçalho da tabela, alinha números à direita e destaca os totais', () => {
    const tabela = tabelaPdf(
      ['Dia', 'Chuva (mm)'],
      [
        ['01/10', 1234.567],
        ['02/10', null],
        ['Total', 1234.567],
      ],
      { colunasNumero: [1], linhasTotal: 1 },
    ) as ContentTable;

    expect(tabela.table.headerRows).toBe(1);
    const [cabecalho, primeira, segunda, total] = tabela.table.body as Record<string, unknown>[][];
    expect(cabecalho[1]).toMatchObject({ text: 'Chuva (mm)', alignment: 'right' });
    expect(primeira[0]).toMatchObject({ text: '01/10', alignment: 'left', bold: false });
    expect(primeira[1]).toMatchObject({ text: '1.234,57', alignment: 'right' });
    expect(segunda[1]).toMatchObject({ text: '—' });
    expect(total[0]).toMatchObject({ bold: true });
  });

  it('desenha o gráfico em SVG com uma linha por série e escapa os rótulos', () => {
    const svg = graficoLinhasSvg([
      { nome: 'Centro <A&B>', pontos: [{ rotulo: '01/10', valor: 0 }, { rotulo: '02/10', valor: 10 }] },
      { nome: 'Norte', pontos: [{ rotulo: '01/10', valor: 5 }, { rotulo: '02/10', valor: 2 }] },
    ]);

    expect(svg.startsWith('<svg')).toBe(true);
    expect(svg.match(/<polyline/g)).toHaveLength(2);
    expect(svg).toContain('Centro &#60;A&#38;B&#62;');
    expect(svg).not.toContain('<A&B>');
  });

  it('não quebra o gráfico sem pontos ou com um ponto só', () => {
    expect(graficoLinhasSvg([])).not.toContain('NaN');
    expect(graficoLinhasSvg([{ nome: 'X', pontos: [{ rotulo: '01/10', valor: 3 }] }])).not.toContain('NaN');
  });

  it('gera um PDF válido com o layout base e o gráfico', async () => {
    const conteudo = await gerarPdf(
      montarRelatorioPdf({
        titulo: 'Teste',
        filtros: [{ rotulo: 'Período', valor: 'hoje' }],
        conteudo: [
          { svg: graficoLinhasSvg([{ nome: 'S', pontos: [{ rotulo: 'a', valor: 1 }, { rotulo: 'b', valor: 2 }] }]) },
          tabelaPdf(['A'], [[1]]),
        ],
        emitidoEm: EMISSAO,
      }),
    );

    expect(conteudo.subarray(0, 5).toString()).toBe('%PDF-');
    expect(conteudo.length).toBeGreaterThan(1000);
  });

  it('envia o PDF como anexo, sem cache e com o tamanho', async () => {
    const resposta = { setHeader: jest.fn(), end: jest.fn() };

    await enviarPdf(resposta as unknown as Response, 'relatorio.pdf', montarRelatorioPdf({ titulo: 'T', filtros: [], conteudo: [] }));

    expect(resposta.setHeader).toHaveBeenCalledWith('Content-Type', 'application/pdf');
    expect(resposta.setHeader).toHaveBeenCalledWith('Content-Disposition', 'attachment; filename="relatorio.pdf"');
    expect(resposta.setHeader).toHaveBeenCalledWith('Cache-Control', 'no-store');
    const enviado = resposta.end.mock.calls[0][0] as Buffer;
    expect(resposta.setHeader).toHaveBeenCalledWith('Content-Length', enviado.length);
    expect(enviado.subarray(0, 5).toString()).toBe('%PDF-');
  });
});
