import { MotivoLeituraErro } from '../../src/generated/prisma/client';

/**
 * Diz se o valor está fora da faixa física do sensor. Os limites são
 * inclusivos (o valor igual ao mínimo ou ao máximo é válido) e opcionais:
 * null ou ausente deixa aquele lado sem checagem.
 */
export function motivoForaDaFaixa(
  valor: number,
  minimo?: number | null,
  maximo?: number | null,
): MotivoLeituraErro | null {
  if (minimo != null && valor < minimo) return MotivoLeituraErro.ABAIXO_DO_MINIMO;
  if (maximo != null && valor > maximo) return MotivoLeituraErro.ACIMA_DO_MAXIMO;
  return null;
}
