import type { AlarmeHistorico, ListaAlarmes, ListaAlertas, OpcoesFiltroAlarmes, OpcoesFiltroAlertas, Usuario } from '@/lib/api';

// Dados de exemplo no formato que a API devolve. Os tipos vêm de lib/api.ts:
// se o contrato mudar lá, o typecheck aponta aqui o que precisa acompanhar.

let sequencia = 0;

export function umUsuario(dados: Partial<Usuario> = {}): Usuario {
  sequencia += 1;
  return {
    id: `usuario-${sequencia}`,
    nome: `Usuário ${sequencia}`,
    email: `usuario${sequencia}@kp.dev`,
    tipo: 'MONITOR',
    ativo: true,
    criadoEm: '2026-09-01T12:00:00.000Z',
    atualizadoEm: '2026-09-01T12:00:00.000Z',
    ...dados,
  };
}

export const ADMIN = umUsuario({ id: 'admin', nome: 'Admin Kernel Panic', email: 'admin@kp.dev', tipo: 'ADMINISTRADOR' });

export function umAlarme(dados: Partial<AlarmeHistorico> = {}): AlarmeHistorico {
  sequencia += 1;
  return {
    id: `alarme-${sequencia}`,
    disparadoEm: '2026-10-18T15:30:00.000Z',
    status: 'ABERTO',
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
