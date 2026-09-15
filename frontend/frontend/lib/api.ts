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

export type SeveridadeAlerta = 'ATENCAO' | 'ALERTA' | 'EMERGENCIA';
export type StatusAlarme = 'ABERTO' | 'RECONHECIDO' | 'RESOLVIDO';

export interface AlarmeHistorico {
  id: string;
  disparadoEm: string;
  status: StatusAlarme;
  severidade: SeveridadeAlerta;
  operador: string;
  valorLimite: number;
  valorMedido: number;
  estacao: { id: string; nome: string };
  parametro: { id: string; nome: string; unidade: string };
}

export interface ListaAlarmes {
  itens: AlarmeHistorico[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface OpcoesFiltroAlarmes {
  estacoes: { id: string; nome: string }[];
  tiposParametro: { id: string; nome: string }[];
  severidades: SeveridadeAlerta[];
  status: StatusAlarme[];
}

export interface FiltrosAlarmes {
  estacaoId?: string;
  tipoParametroId?: string;
  severidade?: SeveridadeAlerta;
  status?: StatusAlarme;
  de?: string;
  ate?: string;
  pagina?: number;
}
