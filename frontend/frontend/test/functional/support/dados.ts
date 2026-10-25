import type {
  AlarmeHistorico,
  LicitacaoApi,
  ListaAlarmes,
  ListaAlertas,
  OpcoesFiltroAlarmes,
  OpcoesFiltroAlertas,
  Usuario,
} from '@/lib/api';

// Dados de exemplo no formato que a API devolve. Os tipos vêm de lib/api.ts:
// se o contrato mudar lá, o typecheck aponta aqui o que precisa acompanhar.

let sequencia = 0;

export function umaLicitacao(dados: Partial<LicitacaoApi> = {}): LicitacaoApi {
  sequencia += 1;
  return {
    id: `licitacao-${sequencia}`,
    codigoIdentificador: `LIC-${sequencia}`,
    numeroProcesso: `PROC-${sequencia}/2026`,
    modalidade: 'PREGAO',
    objeto: 'Monitoramento pluviométrico',
    numeroContrato: `CTR-${sequencia}`,
    inicioVigencia: '2026-01-01T00:00:00.000Z',
    fimVigencia: '2027-12-31T23:59:59.999Z',
    status: 'VIGENTE',
    encerradaEm: null,
    orgaoNome: `Prefeitura ${sequencia}`,
    orgaoCnpj: '11222333000181',
    orgaoEsfera: 'MUNICIPAL',
    orgaoMunicipio: 'São José dos Campos',
    orgaoUf: 'SP',
    criadoEm: '2026-09-01T12:00:00.000Z',
    atualizadoEm: '2026-09-01T12:00:00.000Z',
    quantidadeEstacoes: 0,
    quantidadeUsuarios: 0,
    ...dados,
  };
}

export const LICITACAO_A = umaLicitacao({ id: 'licitacao-a', codigoIdentificador: 'PMSJC-2026', orgaoNome: 'Prefeitura de São José dos Campos' });

function resumoLicitacao(licitacao: LicitacaoApi): NonNullable<Usuario['licitacao']> {
  return {
    id: licitacao.id,
    codigoIdentificador: licitacao.codigoIdentificador,
    orgaoNome: licitacao.orgaoNome,
    status: licitacao.status,
  };
}

/** Por padrão, um usuário comum da LICITACAO_A. */
export function umUsuario(dados: Partial<Usuario> = {}): Usuario {
  sequencia += 1;
  return {
    id: `usuario-${sequencia}`,
    nome: `Usuário ${sequencia}`,
    email: `usuario${sequencia}@kp.dev`,
    tipo: 'USUARIO_LICITACAO',
    licitacao: resumoLicitacao(LICITACAO_A),
    somenteLeitura: false,
    ativo: true,
    criadoEm: '2026-09-01T12:00:00.000Z',
    atualizadoEm: '2026-09-01T12:00:00.000Z',
    ...dados,
  };
}

/** Admin da Tecsus: vê todas as licitações. */
export const ADMIN = umUsuario({ id: 'admin', nome: 'Admin Kernel Panic', email: 'admin@kp.dev', tipo: 'ADMIN_TECSUS', licitacao: null });

/** Admin da LICITACAO_A: cadastra usuários comuns, estações, sensores e alertas dela. */
export const ADMIN_LICITACAO = umUsuario({ id: 'admin-licitacao', nome: 'Admin da Licitação', email: 'admin.lic@kp.dev', tipo: 'ADMIN_LICITACAO' });

/** Usuário comum da LICITACAO_A: só lê (e muda status de alarme). */
export const USUARIO_LICITACAO = umUsuario({ id: 'usuario-licitacao', nome: 'Usuário da Licitação', email: 'usuario.lic@kp.dev' });

/** Admin de uma licitação encerrada: somente leitura. */
export const ADMIN_LICITACAO_ENCERRADA = umUsuario({
  id: 'admin-encerrada',
  nome: 'Admin Encerrada',
  email: 'admin.encerrada@kp.dev',
  tipo: 'ADMIN_LICITACAO',
  licitacao: { ...resumoLicitacao(LICITACAO_A), status: 'ENCERRADA' },
  somenteLeitura: true,
});

export function umAlarme(dados: Partial<AlarmeHistorico> = {}): AlarmeHistorico {
  sequencia += 1;
  return {
    id: `alarme-${sequencia}`,
    disparadoEm: '2026-10-18T15:30:00.000Z',
    status: 'ABERTO',
    licitacaoId: LICITACAO_A.id,
    severidade: 'EMERGENCIA',
    operador: 'MAIOR_QUE',
    valorLimite: 50,
    valorMedido: 72.5,
    estacao: { id: 'estacao-1', nome: 'Estação Centro' },
    parametro: { id: 'parametro-1', nome: 'Precipitação', unidade: 'mm' },
    ...dados,
  };
}

export function pagina<T>(itens: T[]): { itens: T[]; total: number; pagina: number; tamanho: number } {
  return { itens, total: itens.length, pagina: 1, tamanho: 10 };
}

export const SEM_ALARMES: ListaAlarmes = pagina([]);
export const SEM_ALERTAS: ListaAlertas = pagina([]);

export const FILTROS_ALARMES: OpcoesFiltroAlarmes = {
  estacoes: [{ id: 'estacao-1', nome: 'Estação Centro' }],
  tiposParametro: [{ id: 'tipo-1', nome: 'Precipitação' }],
  severidades: ['ATENCAO', 'ALERTA', 'EMERGENCIA'],
  status: ['ABERTO', 'RECONHECIDO', 'RESOLVIDO'],
};

export const FILTROS_ALERTAS: OpcoesFiltroAlertas = {
  estacoes: [{ id: 'estacao-1', nome: 'Estação Centro' }],
  tiposParametro: [{ id: 'tipo-1', nome: 'Precipitação' }],
  parametros: [],
  severidades: ['ATENCAO', 'ALERTA', 'EMERGENCIA'],
};
