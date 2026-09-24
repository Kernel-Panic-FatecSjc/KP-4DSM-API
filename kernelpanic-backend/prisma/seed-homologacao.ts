import 'dotenv/config';
import { Client } from 'pg';

// Seed sintético de homologação, usado pelos smoke tests do CD
// (scripts/smoke-test.sh). Nunca copie dados de produção para homologação
// (LGPD, US01): tudo aqui é fictício e tem id fixo, para que o seed seja
// idempotente e o smoke test saiba exatamente o que consultar.
//
// Depende do usuário criado por `npm run db:seed` (dono da estação).

export const ESTACAO_SMOKE = {
  id: '00000000-0000-4000-8000-00000000e001',
  vid: 'SMOKE-001',
};
export const TIPO_PARAMETRO_SMOKE_ID = '00000000-0000-4000-8000-00000000e002';
export const PARAMETRO_SMOKE_ID = '00000000-0000-4000-8000-00000000e003';
export const ALERTA_SMOKE = {
  id: '00000000-0000-4000-8000-00000000e004',
  operador: 'MAIOR_QUE',
  valorLimite: 100,
  severidade: 'EMERGENCIA',
};

const EMAIL_DONO = process.env.SEED_USUARIO_EMAIL ?? 'admin@kernelpanic.dev';

async function main() {
  // Salvaguarda: uma estação e um alerta fictícios em produção apareceriam no
  // dashboard e gerariam alarmes visíveis para a Defesa Civil.
  if (process.env.AMBIENTE !== 'homologacao') {
    throw new Error(
      `Seed sintético só roda com AMBIENTE=homologacao (recebido: "${process.env.AMBIENTE ?? ''}")`,
    );
  }

  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  try {
    await client.query('BEGIN');

    const dono = await client.query<{ id: string }>(
      'SELECT id FROM usuarios WHERE email = $1',
      [EMAIL_DONO],
    );
    if (dono.rowCount === 0) {
      throw new Error(
        `Usuário ${EMAIL_DONO} não encontrado. Rode "npm run db:seed" antes.`,
      );
    }

    await client.query(
      `INSERT INTO tipos_parametro (id, nome, unidade, fator, ganho)
       VALUES ($1, 'Pluviômetro sintético (smoke test)', 'mm', 1, 0)
       ON CONFLICT (id) DO NOTHING`,
      [TIPO_PARAMETRO_SMOKE_ID],
    );

    await client.query(
      `INSERT INTO estacoes (id, nome, endereco, vid, "usuarioId", "atualizadoEm")
       VALUES ($1, 'Estação sintética de smoke test', 'Homologação: dado fictício', $2, $3, now())
       ON CONFLICT (id) DO NOTHING`,
      [ESTACAO_SMOKE.id, ESTACAO_SMOKE.vid, dono.rows[0].id],
    );

    await client.query(
      `INSERT INTO parametros (id, "estacaoId", "tipoParametroId")
       VALUES ($1, $2, $3)
       ON CONFLICT (id) DO NOTHING`,
      [PARAMETRO_SMOKE_ID, ESTACAO_SMOKE.id, TIPO_PARAMETRO_SMOKE_ID],
    );

    await client.query(
      `INSERT INTO alertas (id, operador, "valorLimite", severidade, ativo, "parametroId")
       VALUES ($1, $2, $3, $4, true, $5)
       ON CONFLICT (id) DO NOTHING`,
      [
        ALERTA_SMOKE.id,
        ALERTA_SMOKE.operador,
        ALERTA_SMOKE.valorLimite,
        ALERTA_SMOKE.severidade,
        PARAMETRO_SMOKE_ID,
      ],
    );

    await client.query('COMMIT');
    console.log(
      `Seed sintético aplicado: estação ${ESTACAO_SMOKE.vid}, alerta ${ALERTA_SMOKE.operador} ${ALERTA_SMOKE.valorLimite}`,
    );
  } catch (erro) {
    await client.query('ROLLBACK');
    throw erro;
  } finally {
    await client.end();
  }
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
