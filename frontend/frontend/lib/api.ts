export class ErroApi extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
  }
}


export const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:3001';


export async function api<T>(caminho: string, opcoes: RequestInit = {}): Promise<T> {
  const resposta = await fetch(`${API_URL}${caminho}`, {
    ...opcoes,
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...opcoes.headers },
  });


  const corpo = await resposta.json().catch(() => null);


  if (!resposta.ok) {
    const mensagem = Array.isArray(corpo?.message)
      ? corpo.message.join(', ')
      : corpo?.message ?? 'Erro inesperado';
    throw new ErroApi(resposta.status, mensagem);
  }


  return corpo as T;
}


/**
 * Baixa um arquivo gerado pela API (CSV em streaming) por navegação comum: o
 * navegador grava direto em disco, sem montar o arquivo na memória da página.
 * O cookie de sessão vai junto, como em qualquer GET para a API.
 */
export function baixarDaApi(caminho: string): void {
  const link = document.createElement('a');
  link.href = `${API_URL}${caminho}`;
  link.rel = 'noopener';
  document.body.appendChild(link);
  link.click();
  link.remove();
}


/** Resposta paginada padrão da API. */
export interface Paginado<T> {
  itens: T[];
  total: number;
  pagina: number;
  tamanho: number;
}


export type TipoUsuario = 'ADMIN_TECSUS' | 'ADMIN_LICITACAO' | 'USUARIO_LICITACAO';


export type StatusLicitacao = 'RASCUNHO' | 'VIGENTE' | 'SUSPENSA' | 'ENCERRADA';


export interface Usuario {
  id: string;
  nome: string;
  email: string;
  tipo: TipoUsuario;
  ativo: boolean;
  /** Nula para a Tecsus. */
  licitacao: { id: string; codigoIdentificador: string; orgaoNome: string; status: StatusLicitacao } | null;
  /** Só no perfil da sessão: a licitação do usuário não está vigente. */
  somenteLeitura?: boolean;
  criadoEm: string;
  atualizadoEm: string;
}


export type ModalidadeLicitacao =
  | 'PREGAO'
  | 'CONCORRENCIA'
  | 'CONCURSO'
  | 'LEILAO'
  | 'DIALOGO_COMPETITIVO'
  | 'DISPENSA'
  | 'INEXIGIBILIDADE'
  | 'OUTRA';


export interface LicitacaoApi {
  id: string;
  codigoIdentificador: string;
  numeroProcesso: string;
  modalidade: ModalidadeLicitacao;
  objeto: string;
  numeroContrato: string;
  inicioVigencia: string;
  fimVigencia: string;
  status: StatusLicitacao;
  encerradaEm: string | null;
  orgaoNome: string;
  orgaoCnpj: string | null;
  orgaoEsfera: EsferaOrgaoApi;
  orgaoMunicipio: string;
  orgaoUf: string;
  criadoEm: string;
  atualizadoEm: string;
  quantidadeEstacoes?: number;
  quantidadeUsuarios?: number;
}


export interface LicitacaoPayload {
  codigoIdentificador: string;
  numeroProcesso: string;
  modalidade: ModalidadeLicitacao;
  objeto: string;
  numeroContrato: string;
  inicioVigencia: string;
  fimVigencia: string;
  status?: StatusLicitacao;
  orgaoNome: string;
  orgaoCnpj?: string | null;
  orgaoEsfera: EsferaOrgaoApi;
  orgaoMunicipio: string;
  orgaoUf: string;
}


export interface RegistroAuditoria {
  id: string;
  criadoEm: string;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  enderecoIp: string | null;
  detalhes: unknown;
  usuario: { id: string; nome: string } | null;
  /** Licitação de quem fez a ação; nula = Tecsus ou visitante. */
  licitacaoId: string | null;
}


export interface ListaAuditoria {
  itens: RegistroAuditoria[];
  total: number;
  pagina: number;
  tamanho: number;
}


export interface LeituraBruta {
  id: string;
  vidEstacao: string;
  recebidoEm: string;
  unixtimeDispositivo: string;
  latitude: number;
  longitude: number;
  payload: unknown;
}


export interface ListaLeiturasBrutas {
  itens: LeituraBruta[];
  total: number;
  pagina: number;
  tamanho: number;
}


export type MotivoLeituraErro = 'ESTACAO_NAO_CADASTRADA' | 'SENSOR_NAO_CONFIGURADO' | 'ABAIXO_DO_MINIMO' | 'ACIMA_DO_MAXIMO';


/** Leitura que o tratamento recebeu e não virou medida. */
export interface LeituraErro {
  id: string;
  leituraBrutaId: string;
  vidEstacao: string;
  nomeSensor: string;
  parametroId: string | null;
  licitacaoId: string | null;
  valor: number;
  unixtime: string;
  motivo: MotivoLeituraErro;
  valorMinimo: number | null;
  valorMaximo: number | null;
  registradoEm: string;
}


export interface EstacaoApi {
  id: string;
  nome: string;
  endereco: string;
  vid: string;
  latitude: number;
  longitude: number;
  statusOperacional: 'ATIVA' | 'INATIVA';
  possuiChaveIngestao: boolean;
  sensores: { id: string; nome: string; unidade: string }[];
  licitacao: { id: string; codigoIdentificador: string };
  criadoEm: string;
  atualizadoEm: string;
}


/** Resposta do cadastro: única vez em que a chave de ingestão aparece. */
export interface EstacaoCriadaApi extends EstacaoApi {
  chaveIngestao: string;
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
  /** Obrigatória para a Tecsus; o admin da licitação pode omitir. */
  licitacaoId?: string;
}


export interface SensorApi {
  id: string;
  nome: string;
  unidade: string;
  fator: number;
  ganho: number;
  valorMinimo: number | null;
  valorMaximo: number | null;
  estacoesAssociadas: number;
  licitacaoId: string;
}


export interface UnidadeSensor {
  valor: string;
  nome: string;
  grandeza: string;
}


export interface SensorPayload {
  nome: string;
  unidade: string;
  fator: number;
  ganho: number;
  valorMinimo: number | null;
  valorMaximo: number | null;
  /** Obrigatória para a Tecsus no cadastro; o admin da licitação pode omitir. */
  licitacaoId?: string;
}


export type SeveridadeAlerta ='ATENCAO' | 'ALERTA' | 'EMERGENCIA';
export type StatusAlarme = 'ABERTO' | 'RECONHECIDO' | 'RESOLVIDO';


export interface AlarmeHistorico {
  id: string;
  disparadoEm: string;
  status: StatusAlarme;
  licitacaoId: string;
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
  licitacaoId: string;
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
  /** Licitação filtrada (nula = todas, só para a Tecsus). */
  licitacaoId: string | null;
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


export type EsferaOrgaoApi = 'MUNICIPAL' | 'ESTADUAL' | 'FEDERAL';

