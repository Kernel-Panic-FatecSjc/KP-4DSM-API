import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Testes unitários: funções, hooks e componentes isolados, num DOM simulado
// (jsdom). Os testes funcionais, no navegador de verdade, ficam com o
// Playwright (playwright.config.ts).
export default defineConfig({
  plugins: [react()],
  resolve: {
    // Lê o alias "@/*" do tsconfig.json.
    tsconfigPaths: true,
  },
  test: {
    environment: 'jsdom',
    include: ['test/unit/**/*.spec.{ts,tsx}'],
    setupFiles: ['./test/unit/setup.ts'],
    // Cada teste começa com mocks e globais (vi.stubGlobal) limpos.
    clearMocks: true,
    restoreMocks: true,
    unstubGlobals: true,
    coverage: {
      provider: 'v8',
      include: ['app/**/*.{ts,tsx}', 'components/**/*.{ts,tsx}', 'lib/**/*.ts'],
      reportsDirectory: './coverage',
    },
  },
});
