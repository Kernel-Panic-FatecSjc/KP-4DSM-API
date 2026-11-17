export const FORMATOS_DADOS_ABERTOS = ['json', 'csv'] as const;
export type FormatoDadosAbertos = (typeof FORMATOS_DADOS_ABERTOS)[number];

/** `?formato=` vale primeiro; sem ele, o header Accept; sem nenhum dos dois, JSON. */
export function resolverFormato(formato?: FormatoDadosAbertos, accept?: string): FormatoDadosAbertos {
  if (formato) return formato;
  return accept?.toLowerCase().includes('text/csv') ? 'csv' : 'json';
}
