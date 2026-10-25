import { calcularHashChaveIngestao } from '../../src/estacoes/chave-ingestao';
import { garantirLicitacaoCarga, prepararEstacoesCarga, SENSORES_CARGA } from './cenario-carga';
import type { Executor } from './simulador-esp32';

export const PREFIXO_VID_HTTP = 'CARGA-HTTP-';
// Todas as estações do cenário usam a mesma chave: o guard confere o hash
// guardado na estação do vid, então a chave única mantém o custo da consulta
// igual ao de uma chave por estação.
export const CHAVE_CARGA_HTTP = 'chave-do-teste-de-carga-http';

export const SENSORES_POR_ESTACAO = SENSORES_CARGA.length;

/**
 * Cria (ou reaproveita) as estações do cenário na licitação de carga, cada
 * uma com os seis parâmetros. Sem alertas: aqui se mede o caminho da
 * ingestão, e os alarmes têm o seu próprio teste (teste-carga-alertas.ts).
 */
export async function prepararCenarioHttp(executor: Executor, quantidade: number): Promise<void> {
  const cenario = await garantirLicitacaoCarga(executor);
  await prepararEstacoesCarga(executor, cenario, PREFIXO_VID_HTTP, quantidade, calcularHashChaveIngestao(CHAVE_CARGA_HTTP));
}
