import { gerarChaveIngestao } from '../../src/estacoes/chave-ingestao';
import { garantirLicitacaoCarga, garantirSensoresCarga } from './cenario-carga';
import type { Executor } from './simulador-esp32';

// Sem hífen: precisa bater com o padrão de nome de sensor aceito pelo
// payload de ingestão (EhMapaDeLeituras), já que o nome do tipoParametro é
// usado como chave do JSON de leituras.
export const NOME_TIPO_PARAMETRO_CARGA = 'temperaturaCarga';
export const PREFIXO_VID_CARGA = 'CARGA-ALERTA-';

export interface EstacaoComAlerta {
  vid: string;
  chaveIngestao: string;
  baseTemperatura: number;
  alertaId: string;
}

async function garantirTipoParametro(executor: Executor, licitacaoId: string): Promise<string> {
  await garantirSensoresCarga(executor, licitacaoId, [[NOME_TIPO_PARAMETRO_CARGA, '°C']]);
  const { rows } = (await executor.query(
    'SELECT id FROM tipos_parametro WHERE nome = $1 AND "licitacaoId" = $2',
    [NOME_TIPO_PARAMETRO_CARGA, licitacaoId],
  )) as { rows: { id: string }[] };
  return rows[0].id;
}

/**
 * Cria (ou reaproveita) estações fakes com usuário, parâmetro e um alerta
 * MAIOR_QUE por estação, para exercitar o pipeline inteiro:
 * POST /ingestao/telemetria (serviço de ingestão) -> leituras_brutas ->
 * tratamento -> medidas -> trigger de alertas -> alarmes. O limite de cada alerta fica em cima da temperatura-base da
 * própria estação, então o ruído aleatório do gerador (+-1°C) cruza a
 * linha com boa frequência — a ideia é ver alarmes sendo criados, não só
 * medidas.
 */
export async function prepararCenarioAlertas(
  executor: Executor,
  quantidade: number,
): Promise<EstacaoComAlerta[]> {
  const { usuarioId, licitacaoId } = await garantirLicitacaoCarga(executor);
  const tipoParametroId = await garantirTipoParametro(executor, licitacaoId);

  const estacoes: EstacaoComAlerta[] = [];

  for (let i = 1; i <= quantidade; i++) {
    const vid = `${PREFIXO_VID_CARGA}${String(i).padStart(5, '0')}`;
    const baseTemperatura = Number((18 + Math.random() * 12).toFixed(1));
    // chave nova a cada execução, já que o banco só guarda o hash
    const { chave, hash } = gerarChaveIngestao();

    const { rows: estacaoRows } = (await executor.query(
      `INSERT INTO estacoes (id, nome, endereco, vid, latitude, longitude, "chaveIngestaoHash", "usuarioId", "licitacaoId", "criadoEm", "atualizadoEm")
       VALUES (gen_random_uuid(), $1, 'Gerado por teste de carga', $2, 0, 0, $3, $4, $5, now(), now())
       ON CONFLICT (vid) DO UPDATE SET nome = EXCLUDED.nome, "chaveIngestaoHash" = EXCLUDED."chaveIngestaoHash"
       RETURNING id`,
      [`Estação de carga ${i}`, vid, hash, usuarioId, licitacaoId],
    )) as { rows: { id: string }[] };
    const estacaoId = estacaoRows[0].id;

    const { rows: parametroRows } = (await executor.query(
      `INSERT INTO parametros (id, "estacaoId", "tipoParametroId", "criadoEm")
       VALUES (gen_random_uuid(), $1, $2, now())
       ON CONFLICT ("estacaoId", "tipoParametroId") DO UPDATE SET "estacaoId" = EXCLUDED."estacaoId"
       RETURNING id`,
      [estacaoId, tipoParametroId],
    )) as { rows: { id: string }[] };
    const parametroId = parametroRows[0].id;

    const { rows: alertaExistente } = (await executor.query(
      'SELECT id FROM alertas WHERE "parametroId" = $1 AND ativo = true LIMIT 1',
      [parametroId],
    )) as { rows: { id: string }[] };

    const alertaId =
      alertaExistente[0]?.id ??
      (
        (await executor.query(
          `INSERT INTO alertas (id, operador, "valorLimite", severidade, ativo, "criadoEm", "parametroId", "licitacaoId")
           VALUES (gen_random_uuid(), 'MAIOR_QUE', $1, 'ALERTA', true, now(), $2, $3)
           RETURNING id`,
          [baseTemperatura, parametroId, licitacaoId],
        )) as { rows: { id: string }[] }
      ).rows[0].id;

    estacoes.push({ vid, chaveIngestao: chave, baseTemperatura, alertaId });
  }

  return estacoes;
}
