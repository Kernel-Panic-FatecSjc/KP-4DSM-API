import { BadRequestException } from '@nestjs/common';
import { once } from 'node:events';
import type { Response } from 'express';

/** Linhas por consulta ao banco: a memória da API fica limitada a um lote. */
export const LINHAS_POR_LOTE_CSV = 2000;

// Mesmo formato que a tela gerava: ";" (Excel em pt-BR), BOM e CRLF.
const SEPARADOR = ';';
const FIM_DE_LINHA = '\r\n';

/** Texto que começa com = + - @ viraria fórmula na planilha: ganha um apóstrofo. */
export function valorCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  let texto = valor instanceof Date ? valor.toISOString() : typeof valor === 'object' ? JSON.stringify(valor) : String(valor);
  if (typeof valor === 'string' && /^[=+\-@]/.test(texto)) texto = `'${texto}`;
  return /[";\r\n]/.test(texto) ? `"${texto.replace(/"/g, '""')}"` : texto;
}

export function linhaCsv(valores: unknown[]): string {
  return valores.map(valorCsv).join(SEPARADOR) + FIM_DE_LINHA;
}

/**
 * Exportação exige período: sem ele, um clique varreria a tabela inteira
 * (milhões de linhas). Devolve as datas já convertidas.
 */
export function exigirPeriodo(de: string | undefined, ate: string | undefined): { de: Date; ate: Date } {
  if (!de || !ate) {
    throw new BadRequestException('Informe o período (de e ate) para exportar');
  }
  const inicio = new Date(de);
  const fim = new Date(ate);
  if (inicio > fim) {
    throw new BadRequestException('A data de início deve ser anterior ou igual à data final');
  }
  return { de: inicio, ate: fim };
}

/**
 * Escreve o CSV na resposta à medida que os lotes chegam do banco, esperando o
 * cliente consumir (drain) antes de pedir o próximo: nem a API nem o navegador
 * seguram o arquivo inteiro na memória.
 */
export async function enviarCsv(
  resposta: Response,
  nomeArquivo: string,
  cabecalho: string[],
  lotes: AsyncIterable<unknown[][]>,
): Promise<void> {
  resposta.setHeader('Content-Type', 'text/csv; charset=utf-8');
  resposta.setHeader('Content-Disposition', `attachment; filename="${nomeArquivo}"`);
  resposta.setHeader('Cache-Control', 'no-store');

  await escrever(resposta, `﻿${linhaCsv(cabecalho)}`);
  for await (const lote of lotes) {
    if (resposta.destroyed) return;
    await escrever(resposta, lote.map(linhaCsv).join(''));
  }
  resposta.end();
}

async function escrever(resposta: Response, conteudo: string): Promise<void> {
  if (!resposta.write(conteudo)) {
    await Promise.race([once(resposta, 'drain'), once(resposta, 'close')]);
  }
}
