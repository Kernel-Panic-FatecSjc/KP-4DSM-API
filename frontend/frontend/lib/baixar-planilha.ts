type ValorCelula = string | number | boolean | Date | null;

export interface OpcoesPlanilha {
  nomeArquivo: string;
  nomeAba: string;
  titulo: string;
  subtitulo: string;
  cabecalhos: string[];
  linhas: ValorCelula[][];
  larguras?: number[];
  colunasData?: number[];
  colunasNumero?: number[];
  colunasComQuebra?: number[];
}

function letraColuna(numero: number): string {
  let resultado = '';
  let atual = numero;
  while (atual > 0) {
    const resto = (atual - 1) % 26;
    resultado = String.fromCharCode(65 + resto) + resultado;
    atual = Math.floor((atual - 1) / 26);
  }
  return resultado;
}

function evitarFormula(valor: ValorCelula): ValorCelula {
  return typeof valor === 'string' && /^[=+@\-]/.test(valor) ? `'${valor}` : valor;
}

export async function baixarPlanilha(opcoes: OpcoesPlanilha): Promise<void> {
  const { Workbook } = await import('exceljs');
  const workbook = new Workbook();
  workbook.creator = 'KP-4DSM API';
  workbook.created = new Date();

  const worksheet = workbook.addWorksheet(opcoes.nomeAba.slice(0, 31));
  const totalColunas = opcoes.cabecalhos.length;
  worksheet.properties.tabColor = { argb: 'FF0F766E' };
  worksheet.columns = opcoes.cabecalhos.map((cabecalho, indice) => ({
    key: `coluna${indice + 1}`,
    width: opcoes.larguras?.[indice] ?? Math.min(Math.max(cabecalho.length + 4, 16), 32),
  }));

  worksheet.mergeCells(1, 1, 1, totalColunas);
  worksheet.getCell(1, 1).value = opcoes.titulo;
  worksheet.getCell(1, 1).font = { bold: true, size: 16, color: { argb: 'FFFFFFFF' } };
  worksheet.getCell(1, 1).alignment = { vertical: 'middle' };
  worksheet.getRow(1).height = 30;
  for (let coluna = 1; coluna <= totalColunas; coluna += 1) {
    worksheet.getCell(1, coluna).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF123B3A' } };
  }

  worksheet.mergeCells(2, 1, 2, totalColunas);
  worksheet.getCell(2, 1).value = opcoes.subtitulo;
  worksheet.getCell(2, 1).font = { size: 10, color: { argb: 'FF475569' } };
  worksheet.getCell(2, 1).alignment = { vertical: 'middle', wrapText: true };
  worksheet.getRow(2).height = 26;
  worksheet.addRow([]);

  const linhaCabecalho = worksheet.addRow(opcoes.cabecalhos);
  linhaCabecalho.height = 28;
  linhaCabecalho.eachCell((celula) => {
    celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0F766E' } };
    celula.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 10 };
    celula.alignment = { vertical: 'middle', wrapText: true };
    celula.border = { bottom: { style: 'medium', color: { argb: 'FF0B5F5B' } } };
  });

  worksheet.addRows(opcoes.linhas.map((linha) => linha.map(evitarFormula)));
  for (let indice = 5; indice <= worksheet.rowCount; indice += 1) {
    const linha = worksheet.getRow(indice);
    linha.height = 22;
    linha.eachCell((celula, coluna) => {
      celula.alignment = { vertical: 'top', wrapText: opcoes.colunasComQuebra?.includes(coluna) ?? false };
      celula.border = { bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } } };
      if (indice % 2 === 0) {
        celula.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF1F7F6' } };
      }
    });
  }

  for (const coluna of opcoes.colunasData ?? []) {
    worksheet.getColumn(coluna).numFmt = 'dd/mm/yyyy hh:mm:ss';
  }
  for (const coluna of opcoes.colunasNumero ?? []) {
    worksheet.getColumn(coluna).numFmt = '0.000000';
  }

  worksheet.views = [{ state: 'frozen', ySplit: 4, topLeftCell: 'A5' }];
  if (totalColunas > 0) {
    worksheet.autoFilter = {
      from: 'A4',
      to: `${letraColuna(totalColunas)}${Math.max(4, worksheet.rowCount)}`,
    };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const conteudo = new Uint8Array(buffer).buffer as ArrayBuffer;
  const arquivo = URL.createObjectURL(new Blob([conteudo], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  }));
  const link = document.createElement('a');
  link.href = arquivo;
  link.download = opcoes.nomeArquivo;
  link.click();
  URL.revokeObjectURL(arquivo);
}