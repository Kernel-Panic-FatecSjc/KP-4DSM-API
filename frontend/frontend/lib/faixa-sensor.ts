export type FaixaLida = { minimo: number | null; maximo: number | null } | { erro: string };

// Vazio deixa o limite sem checagem (null). Aceita vírgula decimal, como os
// campos de fator e ganho do formulário.
function lerLimite(texto: string): number | null {
  const limpo = texto.trim().replace(',', '.');
  return limpo === '' ? null : Number(limpo);
}

export function lerFaixa(minimoTexto: string, maximoTexto: string): FaixaLida {
  const minimo = lerLimite(minimoTexto);
  const maximo = lerLimite(maximoTexto);

  if ((minimo !== null && !Number.isFinite(minimo)) || (maximo !== null && !Number.isFinite(maximo))) {
    return { erro: 'Informe limites numéricos válidos para a faixa, ou deixe em branco.' };
  }
  if (minimo !== null && maximo !== null && minimo > maximo) {
    return { erro: 'O valor mínimo não pode ser maior que o máximo.' };
  }
  return { minimo, maximo };
}

export function formatarFaixa(minimo: number | null | undefined, maximo: number | null | undefined): string {
  if (minimo == null && maximo == null) return 'Sem faixa';
  if (minimo == null) return `até ${maximo}`;
  if (maximo == null) return `a partir de ${minimo}`;
  return `${minimo} a ${maximo}`;
}
