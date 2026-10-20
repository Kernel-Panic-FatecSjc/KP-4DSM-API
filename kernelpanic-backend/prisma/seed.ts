import 'dotenv/config';
import * as bcrypt from 'bcrypt';
import { Client } from 'pg';

const NOME_PADRAO = process.env.SEED_USUARIO_NOME ?? 'Administrador';
const EMAIL_PADRAO = process.env.SEED_USUARIO_EMAIL ?? 'admin@kernelpanic.dev';
const SENHA_PADRAO = process.env.SEED_USUARIO_SENHA ?? 'admin12345';

async function main() {
  const client = new Client({ connectionString: process.env.DATABASE_URL });
  await client.connect();

  const senhaHash = await bcrypt.hash(SENHA_PADRAO, 10);

  await client.query(
    `INSERT INTO usuarios (id, nome, email, "senhaHash", ativo, "criadoEm", "atualizadoEm")
     VALUES (gen_random_uuid(), $1, $2, $3, true, now(), now())
     ON CONFLICT (email) DO NOTHING`,
    [NOME_PADRAO, EMAIL_PADRAO, senhaHash],
  );

  console.log(`Usuário inicial disponível: ${EMAIL_PADRAO} / ${SENHA_PADRAO}`);
  await client.end();
}

main().catch((erro) => {
  console.error(erro);
  process.exit(1);
});
