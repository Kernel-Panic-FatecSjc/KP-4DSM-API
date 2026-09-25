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
  tipo: 'ADMINISTRADOR' | 'MONITOR';
  ativo: boolean;
  criadoEm: string;
  atualizadoEm: string;
}

export interface RegistroAuditoria {
  id: string;
  criadoEm: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  detalhes: unknown;
  usuario: { id: string; nome: string } | null;
}

export interface ListaAuditoria {
  itens: RegistroAuditoria[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface EstacaoApi {
  id: string;
  nome: string;
  endereco: string;
  vid: string;
  latitude: number;
  longitude: number;
  statusOperacional: 'ATIVA' | 'INATIVA';
  sensores: { id: string; nome: string; unidade: string }[];
  criadoEm: string;
  atualizadoEm: string;
}

export interface AtualizarEstacaoPayload {
  nome?: string;
  endereco?: string;
  vid?: string;
  latitude?: number;
  longitude?: number;
  statusOperacional?: 'ATIVA' | 'INATIVA';
  tipoParametroIds?: string[];
}


export interface CriarEstacaoPayload {
  nome: string;
  endereco: string;
  vid: string;
  latitude: number;
  longitude: number;
  tipoParametroIds: string[];
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

export interface Alerta {
  id: string;
  operador: string;
  valorLimite: number;
  severidade: SeveridadeAlerta;
  ativo: boolean;
  criadoEm: string;
  estacao: { id: string; nome: string };
  parametro: { id: string; nome: string; unidade: string };
  acoes?: never;
}

export interface ListaAlertas {
  itens: Alerta[];
  total: number;
  pagina: number;
  tamanho: number;
}

export interface OpcoesFiltroAlertas {
  estacoes: { id: string; nome: string }[];
  tiposParametro: { id: string; nome: string }[];
  parametros: {
    id: string;
    nome: string;
    unidade: string;
    estacaoId: string;
    estacaoNome: string;
  }[];
  severidades: SeveridadeAlerta[];
}

export interface FiltrosAlertas {
  estacaoId?: string;
  tipoParametroId?: string;
  severidade?: SeveridadeAlerta;
  ativo?: boolean;
  pagina?: number;
}

export interface DashboardPonto {
  timestamp: string;
  valor: number;
}

export interface DashboardSerie {
  parametroId: string;
  nome: string;
  unidade: string;
  estacaoId: string;
  estacaoNome: string;
  pontos: DashboardPonto[];
}

export interface DashboardDados {
  periodo: { de: string; ate: string };
  estacoes: { id: string; nome: string; endereco: string }[];
  indicadores: {
    estacoesAtivas: number;
    leituras: number;
    media: number | null;
    alarmesAbertos: number;
  };
  series: DashboardSerie[];
}
