import { defineConfig, devices } from '@playwright/test';

// Ponta a ponta da suíte noturna: o front já está no ar (next start) falando
// com a API e o banco de verdade, sem interceptar nada. Quem sobe a pilha é
// .github/scripts/pilha-e2e.sh; aqui só o navegador.
const CI = !!process.env.CI;

export default defineConfig({
  testDir: './test/e2e',
  outputDir: './test-results-e2e',
  // Um banco só para todos os testes: em série, como os funcionais do backend.
  workers: 1,
  forbidOnly: CI,
  retries: 0,
  reporter: CI ? [['github'], ['html', { open: 'never', outputFolder: 'playwright-report-e2e' }]] : [['list']],
  use: {
    baseURL: process.env.E2E_URL ?? 'http://localhost:3000',
    locale: 'pt-BR',
    timezoneId: 'America/Sao_Paulo',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
});
