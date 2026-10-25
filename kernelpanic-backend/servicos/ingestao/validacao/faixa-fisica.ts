import { MotivoLeituraErro } from '../../../src/generated/prisma/client';

/**
 * Verifica a faixa física inclusiva de um sensor. Limites nulos ou ausentes
 * deixam aquele lado sem restrição.
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
