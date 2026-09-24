// Os testes funcionais rodam num banco próprio, recriado a cada execução
// (ver global-setup.ts), para não gravar dados de teste no banco de
// desenvolvimento. Por padrão é o banco de DATABASE_URL com o sufixo "_test";
// DATABASE_URL_TESTE substitui essa URL por completo.
const SUFIXO_BANCO_DE_TESTE = '_test';

export function obterUrlBancoDeTeste(): string {
  const urlBase = process.env.DATABASE_URL_TESTE ?? process.env.DATABASE_URL;
  if (!urlBase) {
    throw new Error('Defina DATABASE_URL (ou DATABASE_URL_TESTE) para rodar os testes funcionais');
  }

  const url = new URL(urlBase);
  const nomeBanco = url.pathname.slice(1);

  if (!process.env.DATABASE_URL_TESTE) {
    url.pathname = `/${nomeBanco}${SUFIXO_BANCO_DE_TESTE}`;
  } else if (!nomeBanco.endsWith(SUFIXO_BANCO_DE_TESTE)) {
    // O banco é apagado antes de cada execução: a trava evita apontar
    // DATABASE_URL_TESTE para o banco de desenvolvimento por engano.
    throw new Error(`O banco de DATABASE_URL_TESTE precisa terminar em "${SUFIXO_BANCO_DE_TESTE}"`);
  }

  return url.toString();
}
