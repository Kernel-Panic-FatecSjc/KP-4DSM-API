import { vi } from 'vitest';

/** Resposta HTTP com corpo JSON, como a API devolve. */
export function respostaJson(status: number, corpo: unknown): Response {
  return new Response(JSON.stringify(corpo), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

/**
 * Troca o fetch global por um mock que devolve as respostas na ordem dada
 * (a última se repete). O fetch original volta sozinho ao fim do teste
 * (unstubGlobals no vitest.config.mts).
 */
export function mockarFetch(...respostas: Array<() => Promise<Response>>) {
  const fetchMock = vi.fn<typeof fetch>(() => {
    const proxima = respostas.length > 1 ? respostas.shift()! : respostas[0];
    return proxima();
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

export const responde = (status: number, corpo: unknown) => () => Promise.resolve(respostaJson(status, corpo));

export const falhaDeRede = () => () => Promise.reject(new TypeError('Failed to fetch'));

/** Requisição que nunca termina, para ver o estado de carregando. */
export const pendente = () => () => new Promise<Response>(() => undefined);
