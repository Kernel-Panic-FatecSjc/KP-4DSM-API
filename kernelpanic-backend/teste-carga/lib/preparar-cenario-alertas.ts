import type { Executor } from './simulador-esp32';

// Sem hífen: precisa bater com o padrão de nome de sensor aceito pelo
// payload de ingestão (EhMapaDeLeituras), já que o nome do tipoParametro é
// usado como chave do JSON de leituras.
export const NOME_TIPO_PARAMETRO_CARGA = 'temperaturaCarga';
export const PREFIXO_VID_CARGA = 'CARGA-ALERTA-';

const EMAIL_USUARIO_CARGA = 'carga-alertas@kernelpanic.dev';

export interface EstacaoComAlerta {
  vid: string;
  baseTemperatura: number;
  alertaId: string;
}

async function garantirUsuarioDeCarga(executor: Executor): Promise<string> {
  await executor.query(
    `INSERT INTO usuarios (id, nome, email, "senhaHash", ativo, "criadoEm", "atualizadoEm")
     VALUES (gen_random_uuid(), 'Usuário Teste de Carga', $1, 'x', true, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [EMAIL_USUARIO_CARGA],
  );

  const { rows } = (await executor.query('SELECT id FROM usuarios WHERE email = $1', [
    EMAIL_USUARIO_CARGA,
  ])) as { rows: { id: string }[] };

  return rows[0].id;
}

async function garantirTipoParametro(executor: Executor): Promise<string> {
  const { rows: existentes } = (await executor.query(
    'SELECT id FROM tipos_parametro WHERE nome = $1',
    [NOME_TIPO_PARAMETRO_CARGA],
  )) as { rows: { id: string }[] };
  if (existentes.length > 0) return existentes[0].id;

  const { rows } = (await executor.query(
    `INSERT INTO tipos_parametro (id, nome, unidade, fator, ganho)
     VALUES (gen_random_uuid(), $1, '°C', 1, 0)
     RETURNING id`,
    [NOME_TIPO_PARAMETRO_CARGA],
  )) as { rows: { id: string }[] };

  return rows[0].id;
}

/**
 * Cria (ou reaproveita) estações fakes com usuário, parâmetro e um alerta
 * MAIOR_QUE por estação, para exercitar o pipeline inteiro:
 * POST /ingestao/telemetria -> lote de medidas -> trigger de alertas ->
 * alarmes. O limite de cada alerta fica em cima da temperatura-base da
 * própria estação, então o ruído aleatório do gerador (+-1°C) cruza a
 * linha com boa frequência — a ideia é ver alarmes sendo criados, não só
 * medidas.
 */
export async function prepararCenarioAlertas(
  executor: Executor,
  quantidade: number,
): Promise<EstacaoComAlerta[]> {
  const usuarioId = await garantirUsuarioDeCarga(executor);
  const tipoParametroId = await garantirTipoParametro(executor);

  const estacoes: EstacaoComAlerta[] = [];

  for (let i = 1; i <= quantidade; i++) {
    const vid = `${PREFIXO_VID_CARGA}${String(i).padStart(5, '0')}`;
    const baseTemperatura = Number((18 + Math.random() * 12).toFixed(1));

    const { rows: estacaoRows } = (await executor.query(
      `INSERT INTO estacoes (id, nome, endereco, vid, latitude, longitude, "usuarioId", "criadoEm", "atualizadoEm")
       VALUES (gen_random_uuid(), $1, 'Gerado por teste de carga', $2, 0, 0, $3, now(), now())
       ON CONFLICT (vid) DO UPDATE SET nome = EXCLUDED.nome
       RETURNING id`,
      [`Estação de carga ${i}`, vid, usuarioId],
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
          `INSERT INTO alertas (id, operador, "valorLimite", severidade, ativo, "criadoEm", "parametroId")
           VALUES (gen_random_uuid(), 'MAIOR_QUE', $1, 'ALERTA', true, now(), $2)
           RETURNING id`,
          [baseTemperatura, parametroId],
        )) as { rows: { id: string }[] }
      ).rows[0].id;

    estacoes.push({ vid, baseTemperatura, alertaId });
  }

  return estacoes;
}
