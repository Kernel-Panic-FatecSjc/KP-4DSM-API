const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';

export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}

export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opcoes.headers },
  });

  const corpo = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    throw new ErroApi(resposta.status, corpo?.message ?? 'Erro inesperado');
  }

  return corpo as T;
}

export interface Usuario {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}
