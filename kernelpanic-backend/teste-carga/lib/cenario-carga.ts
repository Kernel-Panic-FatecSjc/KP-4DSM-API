import type { Executor } from './simulador-esp32';

// Tudo que os testes de carga criam fica numa licitação própria, separada dos
// dados de quem usa o banco (que de toda forma deve ser um banco só de carga).
export const CODIGO_LICITACAO_CARGA = 'CARGA';
const EMAIL_USUARIO_CARGA = 'carga@kernelpanic.dev';

// Os mesmos seis sensores que gerarPayload (simulador-esp32.ts) envia: o nome
// do tipo de parâmetro é a chave do JSON de leituras.
export const SENSORES_CARGA: [string, string][] = [
  ['temperatura', '°C'],
  ['umidade', '%'],
  ['pressao', 'hPa'],
  ['chuvaMm', 'mm'],
  ['ventoVelocidadeKmh', 'km/h'],
  ['ventoDirecaoGraus', '°'],
];

export interface CenarioCarga {
  usuarioId: string;
  licitacaoId: string;
}

/** Licitação vigente "CARGA" e o usuário da Tecsus que cadastra as estações dela. */
export async function garantirLicitacaoCarga(executor: Executor): Promise<CenarioCarga> {
  await executor.query(
    `INSERT INTO usuarios (id, nome, email, "senhaHash", tipo, ativo, "criadoEm", "atualizadoEm")
     VALUES (gen_random_uuid(), 'Usuário Teste de Carga', $1, 'x', 'ADMIN_TECSUS', true, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [EMAIL_USUARIO_CARGA],
  );
  await executor.query(
    `INSERT INTO licitacoes (id, "codigoIdentificador", "numeroProcesso", modalidade, objeto, "numeroContrato",
       "inicioVigencia", "fimVigencia", status, "orgaoNome", "orgaoEsfera", "orgaoMunicipio", "orgaoUf", "atualizadoEm")
     VALUES (gen_random_uuid(), $1, $1, 'OUTRA', 'Teste de carga', $1, now(), now() + interval '10 years', 'VIGENTE',
       'Órgão de teste de carga', 'MUNICIPAL', 'São José dos Campos', 'SP', now())
     ON CONFLICT ("codigoIdentificador") DO NOTHING`,
    [CODIGO_LICITACAO_CARGA],
  );
  const { rows } = (await executor.query(
    `SELECT (SELECT id FROM usuarios WHERE email = $1) AS "usuarioId",
            (SELECT id FROM licitacoes WHERE "codigoIdentificador" = $2) AS "licitacaoId"`,
    [EMAIL_USUARIO_CARGA, CODIGO_LICITACAO_CARGA],
  )) as { rows: CenarioCarga[] };
  return rows[0];
}

/** Tipos de parâmetro (sensores) da licitação de carga, criados se faltarem. */
export async function garantirSensoresCarga(
  executor: Executor,
  licitacaoId: string,
  sensores: [string, string][] = SENSORES_CARGA,
): Promise<void> {
  for (const [nome, unidade] of sensores) {
    await executor.query(
      `INSERT INTO tipos_parametro (id, nome, unidade, fator, ganho, "licitacaoId")
       SELECT gen_random_uuid(), $1::text, $2::text, 1, 0, $3::text
       WHERE NOT EXISTS (SELECT 1 FROM tipos_parametro WHERE nome = $1::text AND "licitacaoId" = $3::text)`,
      [nome, unidade, licitacaoId],
    );
  }
}

/**
 * Cria (ou reaproveita) `quantidade` estações com o prefixo de vid, todas com
 * os sensores informados, em INSERTs por conjunto (milhares em segundos).
 */
export async function prepararEstacoesCarga(
  executor: Executor,
  cenario: CenarioCarga,
  prefixoVid: string,
  quantidade: number,
  hashChave: string | null,
  sensores: [string, string][] = SENSORES_CARGA,
): Promise<void> {
  await garantirSensoresCarga(executor, cenario.licitacaoId, sensores);
  await executor.query(
    `INSERT INTO estacoes (id, nome, endereco, vid, latitude, longitude, "chaveIngestaoHash", "usuarioId", "licitacaoId", "criadoEm", "atualizadoEm")
     SELECT gen_random_uuid(), 'Estação de carga ' || i, 'Gerado por teste de carga',
            $1 || lpad(i::text, 5, '0'), -23.2, -45.9, $2, $3, $4, now(), now()
     FROM generate_series(1, $5::int) AS i
     ON CONFLICT (vid) DO UPDATE SET "chaveIngestaoHash" = EXCLUDED."chaveIngestaoHash", "statusOperacional" = 'ATIVA'`,
    [prefixoVid, hashChave, cenario.usuarioId, cenario.licitacaoId, quantidade],
  );
  await executor.query(
    `INSERT INTO parametros (id, "estacaoId", "tipoParametroId", "criadoEm")
     SELECT gen_random_uuid(), e.id, t.id, now()
     FROM estacoes e JOIN tipos_parametro t ON t."licitacaoId" = e."licitacaoId"
     WHERE e.vid LIKE $1 AND t.nome = ANY($2::text[])
     ON CONFLICT ("estacaoId", "tipoParametroId") DO NOTHING`,
    [`${prefixoVid}%`, sensores.map(([nome]) => nome)],
  );
}
