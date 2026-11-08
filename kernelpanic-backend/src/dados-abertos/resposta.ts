import type { Response } from 'express';
import { enviarCsv } from '../exportacao/csv';
import type { FormatoDadosAbertos } from './formato';

/** Manda o mesmo conjunto de linhas como JSON (`corpo`) ou como CSV (`cabecalho` + `linhas`). */
export async function responder(
  resposta: Response,
  formato: FormatoDadosAbertos,
  corpo: unknown,
  arquivo: string,
  cabecalho: string[],
  linhas: unknown[][],
): Promise<void> {
  if (formato === 'json') {
    resposta.json(corpo);
    return;
  }
  async function* lotes() {
    yield linhas;
  }
  await enviarCsv(resposta, arquivo, cabecalho, lotes());
}
