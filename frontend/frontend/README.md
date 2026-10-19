This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Testes

Os testes ficam em `test/`, separados por natureza, como no backend:

- `test/unit/` — **Vitest + Testing Library**, num DOM simulado (jsdom). Funções de
  `lib/`, componentes e páginas isolados: o `fetch` e o `next/navigation` são
  trocados por mocks. Rodam em segundos e não precisam de nada de pé.
- `test/functional/` — **Playwright**, num Chromium de verdade, sobre o build de
  produção do Next.js. Testam o fluxo como o usuário faz (entrar, navegar,
  preencher formulário). A API **não** sobe: cada teste responde as rotas que a tela
  chama, então não precisa de backend nem banco.

```bash
# testes unitários
npm run test

# unitários em modo watch, reexecutando a cada alteração
npm run test:watch

# cobertura (unitários), em coverage/index.html
npm run test:cov

# testes funcionais (faz o build e sobe o Next.js na porta 3100)
npm run test:functional

# funcionais no modo interativo: escolhe o teste, vê o navegador passo a passo
npm run test:functional:ui
```

Na primeira vez, baixe o navegador do Playwright: `npx playwright install chromium`.

Para não refazer o build a cada execução enquanto escreve um teste funcional, deixe
um servidor aberto na porta 3100 (`npm run dev -- --port 3100`) e rode
`npm run test:functional`: o Playwright usa o servidor que já está de pé. Nesse caso o
servidor precisa apontar para a API padrão (`http://localhost:3001`), que é a que os
testes interceptam: não defina `NEXT_PUBLIC_API_URL` no `.env.local`.

No CI os dois rodam no job **Testes (Next.js)** sempre que o PR mexe no frontend. Se
um funcional falhar, o job publica o artefato `relatorio-playwright`: baixe, extraia e
abra com `npx playwright show-report <pasta extraída>/playwright-report` para ver o
trace (cada passo, a tela e as requisições).

### Qual teste escrever

| Quero garantir que...                                   | Onde                                  |
| ------------------------------------------------------- | ------------------------------------- |
| uma função de `lib/` calcula/formata/valida certo        | `test/unit/lib/<arquivo>.spec.ts`     |
| um componente reage a props, cliques e estados           | `test/unit/components/<Nome>.spec.tsx`|
| uma página trata as respostas da API (erro, vazio, 401)  | `test/unit/app/<pagina>.spec.tsx`     |
| o usuário consegue fazer o fluxo inteiro da tela         | `test/functional/<tela>.spec.ts`      |

Nome do arquivo: o mesmo do código testado, terminado em `.spec.ts` ou `.spec.tsx`.
Toda US que mexe no frontend entra com os testes do que ela entrega.

### Escrevendo um teste unitário

Use os exemplos de `test/unit/` como ponto de partida. O essencial:

```tsx
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it } from 'vitest';
import { mockarFetch, responde } from '../helpers';

// LoginPage usa useRouter: o arquivo de verdade também mocka o next/navigation
// (veja test/unit/app/login.spec.tsx).
it('mostra o erro da API', async () => {
  mockarFetch(responde(401, { message: 'Credenciais inválidas' }));
  render(<LoginPage />);

  await userEvent.click(screen.getByRole('button', { name: 'Entrar' }));

  expect(await screen.findByText('Credenciais inválidas')).toBeInTheDocument();
});
```

- Busque os elementos como o usuário enxerga: `getByRole`, `getByLabelText`,
  `getByText`. Evite seletor de classe CSS.
- Componente que usa `useRouter`/`usePathname` precisa do `vi.mock('next/navigation')`:
  veja `test/unit/components/ProtectedLayout.spec.tsx`.
- O histórico dos mocks é zerado e o `fetch` original volta sozinho entre um teste e outro.

### Escrevendo um teste funcional

Importe `test` e `expect` de `./support/teste` (não de `@playwright/test`): ele já
instala a API falsa na página, disponível como `api`.

```ts
import { ADMIN, umUsuario } from './support/dados';
import { expect, logarComo, test } from './support/teste';

test('lista os usuários', async ({ page, api }) => {
  logarComo(api, ADMIN);
  api.responder('GET /usuarios', { body: [ADMIN, umUsuario({ nome: 'Ana' })] });
  api.responder('DELETE /usuarios/:id', { body: {} });

  await page.goto('/usuarios');

  await expect(page.getByRole('row', { name: /Ana/ })).toBeVisible();
});
```

- Sem `logarComo`, o navegador está sem sessão (o perfil responde 401).
- A resposta pode ser uma função, para olhar o corpo ou mudar de estado:
  `api.responder('POST /usuarios', ({ corpo }) => ({ status: 201, body: ... }))`.
- `api.chamadasDe('POST /usuarios')` devolve o que a tela enviou (corpo, query, params).
- Se a tela chamar uma rota que o teste não respondeu, o teste falha listando qual.
  Assim, uma chamada nova na tela não passa despercebida.
- Os dados de exemplo (`support/dados.ts`) usam os tipos de `lib/api.ts`: se o
  contrato da API mudar lá, o typecheck aponta os testes que precisam acompanhar.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
