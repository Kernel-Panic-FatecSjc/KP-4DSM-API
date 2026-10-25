/**
 * Formato do tópico MQTT (docs/mqtt-topico-payload.md). O vid da estação é o
 * usuário dela no broker e só ela publica no próprio tópico (ACL por estação).
 * Fica num arquivo sem dependências porque o serviço de ingestão e o simulador
 * usam o mesmo formato.
 */
export const TOPICO_TELEMETRIA_ASSINATURA = 'estacoes/+/telemetria';

export function topicoTelemetria(vid: string): string {
  return `estacoes/${vid}/telemetria`;
}

/** vid do tópico estacoes/{vid}/telemetria, ou null se o tópico não segue o formato. */
export function vidDoTopico(topico: string): string | null {
  const partes = topico.split('/');
  if (partes.length !== 3 || partes[0] !== 'estacoes' || partes[2] !== 'telemetria' || !partes[1]) return null;
  return partes[1];
}

/** Papel (dynsec) que dá à estação o direito de publicar só no próprio tópico. */
export function papelDaEstacao(vid: string): string {
  return `estacao-${vid}`;
}
