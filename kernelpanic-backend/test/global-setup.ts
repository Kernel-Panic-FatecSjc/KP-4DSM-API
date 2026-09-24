import 'dotenv/config';
import { execSync } from 'node:child_process';
import { obterUrlBancoDeTeste } from './banco-de-teste';

// Recria o banco de teste do zero antes da suíte funcional: apaga, cria se
// não existir e aplica todas as migrations. Assim cada execução começa limpa
// sem que as specs precisem apagar o que gravaram.
export default function prepararBancoDeTeste(): void {
  execSync('npx prisma migrate reset --force', {
    env: { ...process.env, DATABASE_URL: obterUrlBancoDeTeste() },
    stdio: 'inherit',
  });
}
