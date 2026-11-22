import { test as base, expect } from '@playwright/test';
import type { Usuario } from '@/lib/api';
import { ApiFalsa, type RespostaFalsa } from './api-falsa';

export { expect };

export const SEM_SESSAO: RespostaFalsa = { status: 401, body: { statusCode: 401, message: 'Sessão inválida' } };

/**
 * `test` do Playwright com a API falsa já instalada na página. Use este no
 * lugar do de @playwright/test:
 *
 *   test('lista os usuários', async ({ page, api }) => {
 *     logarComo(api, ADMIN);
 *     api.responder('GET /usuarios', { body: [ADMIN] });
 *     await page.goto('/usuarios');
 *   });
 */
export const test = base.extend<{ api: ApiFalsa }>({
  api: [
    async ({ page }, usar) => {
      const api = new ApiFalsa();
      // Navegador novo começa sem sessão.
      api.responder('GET /autenticacao/perfil', SEM_SESSAO);
      await api.instalar(page);

      await usar(api);

      expect(api.naoRespondidas, 'A tela chamou rotas da API que o teste não respondeu').toEqual([]);
    },
    // Instala mesmo no teste que não pede `api`: nenhuma requisição chega numa API de verdade.
    { auto: true },
  ],
});

/** A partir daqui a API reconhece o cookie de sessão deste usuário. */
export function logarComo(api: ApiFalsa, usuario: Usuario): void {
  api.responder('GET /autenticacao/perfil', { body: usuario });
}
