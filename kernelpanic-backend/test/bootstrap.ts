import 'dotenv/config';
import { obterUrlBancoDeTeste } from './banco-de-teste';

const PADROES_DE_TESTE: Record<string, string> = {
  JWT_SECRET: 'segredo-de-teste',
  JWT_EXPIRES_IN: '1h',
  COOKIE_SECURE: 'false',
  COOKIE_SAMESITE: 'lax',
  FRONTEND_URL: 'http://localhost:3000',
};

for (const [chave, valor] of Object.entries(PADROES_DE_TESTE)) {
  process.env[chave] ??= valor;
}

process.env.DATABASE_URL = obterUrlBancoDeTeste();
