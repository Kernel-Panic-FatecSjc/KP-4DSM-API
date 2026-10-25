import { calcularHashChaveIngestao } from '../../src/estacoes/chave-ingestao';
import type { Executor } from './simulador-esp32';

export const PREFIXO_VID_HTTP = 'CARGA-HTTP-';
// Todas as estações do cenário usam a mesma chave: o guard confere o hash
// guardado na estação do vid, então a chave única mantém o custo da consulta
// igual ao de uma chave por estação.
export const CHAVE_CARGA_HTTP = 'chave-do-teste-de-carga-http';

const EMAIL_USUARIO_CARGA = 'carga-http@kernelpanic.dev';

// Os mesmos seis sensores que gerarPayload (simulador-esp32.ts) envia: o nome
// do tipo de parâmetro é a chave do JSON de leituras.
const SENSORES: [string, string][] = [
  ['temperatura', '°C'],
  ['umidade', '%'],
  ['pressao', 'hPa'],
  ['chuvaMm', 'mm'],
  ['ventoVelocidadeKmh', 'km/h'],
  ['ventoDirecaoGraus', '°'],
];

export const SENSORES_POR_ESTACAO = SENSORES.length;

/**
 * Cria (ou reaproveita) as estações do cenário, cada uma com os seis
 * parâmetros, em INSERTs por conjunto (milhares de estações em segundos).
 * Sem alertas: aqui se mede o caminho da ingestão, e os alarmes têm o seu
 * próprio teste (teste-carga-alertas.ts).
 */
export async function prepararCenarioHttp(executor: Executor, quantidade: number): Promise<void> {
  await executor.query(
    `INSERT INTO usuarios (id, nome, email, "senhaHash", ativo, "criadoEm", "atualizadoEm")
     VALUES (gen_random_uuid(), 'Usuário Teste de Carga HTTP', $1, 'x', true, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [EMAIL_USUARIO_CARGA],
  );

  for (const [nome, unidade] of SENSORES) {
    await executor.query(
      `INSERT INTO tipos_parametro (id, nome, unidade, fator, ganho)
       SELECT gen_random_uuid(), $1::text, $2::text, 1, 0
       WHERE NOT EXISTS (SELECT 1 FROM tipos_parametro WHERE nome = $1::text)`,
      [nome, unidade],
    );
  }

  await executor.query(
    `INSERT INTO estacoes (id, nome, endereco, vid, latitude, longitude, "chaveIngestaoHash", "usuarioId", "criadoEm", "atualizadoEm")
     SELECT gen_random_uuid(), 'Estação de carga HTTP ' || i, 'Gerado por teste de carga',
            $1 || lpad(i::text, 5, '0'), 0, 0, $2, (SELECT id FROM usuarios WHERE email = $3), now(), now()
     FROM generate_series(1, $4::int) AS i
     ON CONFLICT (vid) DO UPDATE SET "chaveIngestaoHash" = EXCLUDED."chaveIngestaoHash"`,
    [PREFIXO_VID_HTTP, calcularHashChaveIngestao(CHAVE_CARGA_HTTP), EMAIL_USUARIO_CARGA, quantidade],
  );

  await executor.query(
    `INSERT INTO parametros (id, "estacaoId", "tipoParametroId", "criadoEm")
     SELECT gen_random_uuid(), e.id, t.id, now()
     FROM estacoes e CROSS JOIN tipos_parametro t
     WHERE e.vid LIKE $1 AND t.nome = ANY($2::text[])
     ON CONFLICT ("estacaoId", "tipoParametroId") DO NOTHING`,
    [`${PREFIXO_VID_HTTP}%`, SENSORES.map(([nome]) => nome)],
  );
}
