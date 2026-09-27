import 'dotenv/config';
import { obterUrlBancoDeTeste } from './banco-de-teste';

const PADROES_DE_TESTE: Record<string, string> = {
  JWT_SECRET: 'segredo-de-teste',
  JWT_EXPIRES_IN: '1h',
  COOKIE_SECURE: 'false',
  COOKIE_SAMESITE: 'lax',
  FRONTEND_URL: 'http://localhost:3000',
  // as specs disparam muitas requisições do mesmo IP; o limite em si é
  // testado em limite-requisicoes.spec.ts, que baixa estes valores.
  LIMITE_REQUISICOES_POR_MINUTO: '100000',
  LIMITE_LOGIN_POR_MINUTO: '100000',
  // o LISTEN do tempo real abriria uma conexão real com o banco em toda spec,
  // inclusive nas que usam o Prisma mockado; alarmes-tempo-real.spec.ts liga.
  ALARMES_TEMPO_REAL: 'false',
};

for (const [chave, valor] of Object.entries(PADROES_DE_TESTE)) {
  process.env[chave] ??= valor;
}

process.env.DATABASE_URL = obterUrlBancoDeTeste();
