import { defineConfig, devices } from '@playwright/test';
import { API_URL } from './lib/api';

// Testes funcionais: o build de produção do Next.js num Chromium de verdade.
// A API não sobe: cada teste responde as rotas que a tela chama
// (test/functional/support/api-falsa.ts), então não precisa de backend nem banco.
const PORTA = 3100;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './test/functional',
  outputDir: './test-results',
  fullyParallel: true,
  forbidOnly: CI,
  // Sem nova tentativa: teste que só passa na segunda vez é bug a corrigir.
  retries: 0,
  reporter: CI ? [['github'], ['html', { open: 'never' }]] : [['list'], ['html', { open: 'never' }]],
  use: {
    baseURL: `http://localhost:${PORTA}`,
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `npm run build && npm run start -- --port ${PORTA}`,
    url: `http://localhost:${PORTA}`,
    // Local, aproveita um servidor já aberto na porta (ex.: npm run dev -- --port 3100).
    reuseExistingServer: !CI,
    timeout: 5 * 60 * 1000,
    stdout: 'pipe',
    // Fixa a URL da API do build na mesma que os testes interceptam, mesmo
    // que o .env.local aponte para outra.
    env: { NEXT_PUBLIC_API_URL: API_URL },
  },
});
