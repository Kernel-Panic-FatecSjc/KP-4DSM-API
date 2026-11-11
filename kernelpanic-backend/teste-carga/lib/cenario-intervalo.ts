/**
 * Cenário do RNF20.2 (US16): a frota inteira enviando a cada `intervaloS`
 * segundos. Com as estações publicando em rodízio, cada uma envia uma vez por
 * intervalo, e a taxa média da plataforma é estações / intervalo.
 */
export interface CenarioIntervalo {
  /** Mensagens por segundo da frota (pode ser fracionária: 1.000 estações a cada 300 s = 3,33/s). */
  taxa: number;
  /** Duração padrão da medição: um ciclo completo, para toda estação enviar ao menos uma vez. */
  duracaoS: number;
}

export function cenarioPorIntervalo(numEstacoes: number, intervaloS: number, ciclos = 1): CenarioIntervalo {
  if (!Number.isFinite(numEstacoes) || numEstacoes < 1) throw new Error('NUM_ESTACOES deve ser um inteiro positivo.');
  if (!Number.isFinite(intervaloS) || intervaloS <= 0) throw new Error('INTERVALO_ENVIO_S deve ser maior que zero.');
  if (!Number.isFinite(ciclos) || ciclos < 1) throw new Error('CICLOS deve ser pelo menos 1.');
  return { taxa: numEstacoes / intervaloS, duracaoS: intervaloS * ciclos };
}
