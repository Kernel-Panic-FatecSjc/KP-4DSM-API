/**
 * Data de filtro dos relatórios: data sem horário vale o dia inteiro (UTC)
 * quando é o fim do período, para o limite ser inclusivo.
 */
export function dataDoFiltro(valor: string, finalDoDia = false): Date {
  const data = new Date(valor);
  if (finalDoDia && /^\d{4}-\d{2}-\d{2}$/.test(valor)) {
    data.setUTCHours(23, 59, 59, 999);
  }
  return data;
}
