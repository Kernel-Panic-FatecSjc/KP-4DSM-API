// Gera o PDF de exemplo do layout base (SCRUM-52), versionado em
// docs/exemplos/relatorio-pdf-exemplo.pdf. Dados fictícios.
// Uso: npm run pdf:exemplo
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { gerarPdf, graficoLinhasSvg, montarRelatorioPdf, tabelaPdf } from '../src/exportacao/pdf';

const DESTINO = join(__dirname, '..', '..', 'docs', 'exemplos', 'relatorio-pdf-exemplo.pdf');

const dias = Array.from({ length: 14 }, (_, indice) => `${String(indice + 1).padStart(2, '0')}/10`);
const chuvaCentro = [0, 2.4, 12.8, 35.2, 8.1, 0, 0, 1.2, 4.6, 22.0, 41.5, 15.3, 3.0, 0];
const chuvaNorte = [0, 1.1, 9.7, 28.4, 11.6, 0.4, 0, 0, 6.2, 18.9, 37.0, 19.8, 2.2, 0];
const total = (valores: number[]) => valores.reduce((soma, valor) => soma + valor, 0);

// Uma linha por dia e estação: 28 linhas, o bastante para a tabela quebrar de
// página e mostrar o cabeçalho repetido.
const linhas: unknown[][] = dias.flatMap((dia, indice) => [
  [`${dia}/2026`, 'Estação Centro', chuvaCentro[indice]],
  [`${dia}/2026`, 'Estação Norte', chuvaNorte[indice]],
]);

const documento = montarRelatorioPdf({
  titulo: 'Relatório de exemplo — layout base',
  subtitulo: 'Demonstração do cabeçalho, filtros, tabela, gráfico, rodapé e paginação. Dados fictícios.',
  instituicao: 'Licitação PE-001/2026 · Prefeitura de Exemplo',
  filtros: [
    { rotulo: 'Período', valor: '01/10/2026 a 14/10/2026' },
    { rotulo: 'Granularidade', valor: 'Dia' },
    { rotulo: 'Estações', valor: 'Estação Centro, Estação Norte' },
    { rotulo: 'Parâmetro', valor: 'Precipitação (mm)' },
  ],
  emitidoEm: new Date('2026-11-07T15:30:00-03:00'),
  emitidoPor: 'Usuário de exemplo',
  conteudo: [
    { text: 'Precipitação diária', style: 'secao' },
    {
      svg: graficoLinhasSvg([
        { nome: 'Estação Centro', pontos: dias.map((rotulo, indice) => ({ rotulo, valor: chuvaCentro[indice] })) },
        { nome: 'Estação Norte', pontos: dias.map((rotulo, indice) => ({ rotulo, valor: chuvaNorte[indice] })) },
      ]),
    },
    { text: 'Acumulado por dia e estação', style: 'secao' },
    tabelaPdf(
      ['Dia', 'Estação', 'Precipitação (mm)'],
      [
        ...linhas,
        ['Total do período', 'Estação Centro', total(chuvaCentro)],
        ['Total do período', 'Estação Norte', total(chuvaNorte)],
      ],
      { larguras: [110, '*', 110], colunasNumero: [2], linhasTotal: 2 },
    ),
  ],
});

gerarPdf(documento)
  .then((conteudo) => {
    mkdirSync(join(DESTINO, '..'), { recursive: true });
    writeFileSync(DESTINO, conteudo);
    console.log(`PDF gerado em ${DESTINO} (${conteudo.length} bytes)`);
  })
  .catch((erro: unknown) => {
    console.error(erro);
    process.exitCode = 1;
  });
