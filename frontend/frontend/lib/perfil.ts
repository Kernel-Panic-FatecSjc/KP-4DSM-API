import type { StatusLicitacao, TipoUsuario, Usuario } from './api';

// As permissões valem no backend (GuardaPerfil e filtro de licitação); aqui
// elas só decidem o que a tela mostra, para ninguém ver um botão que daria 403.

export const ROTULO_PERFIL: Record<TipoUsuario, string> = {
  ADMIN_TECSUS: 'Admin Tecsus',
  ADMIN_LICITACAO: 'Admin da licitação',
  USUARIO_LICITACAO: 'Usuário da licitação',
};

export const ROTULO_STATUS_LICITACAO: Record<StatusLicitacao, string> = {
  RASCUNHO: 'Rascunho',
  VIGENTE: 'Vigente',
  SUSPENSA: 'Suspensa',
  ENCERRADA: 'Encerrada',
};

/** A Tecsus vê todas as licitações e escolhe qual filtrar. */
export function ehTecsus(usuario: Usuario | null | undefined): boolean {
  return usuario?.tipo === 'ADMIN_TECSUS';
}

/** Licitação não vigente: o usuário dela só lê. A Tecsus nunca fica somente leitura. */
export function somenteLeitura(usuario: Usuario | null | undefined): boolean {
  return Boolean(usuario?.somenteLeitura);
}

/** Cadastros (estações, sensores, alertas, usuários): Tecsus e admin da licitação, fora de licitação encerrada. */
export function podeCadastrar(usuario: Usuario | null | undefined): boolean {
  if (!usuario || somenteLeitura(usuario)) return false;
  return usuario.tipo === 'ADMIN_TECSUS' || usuario.tipo === 'ADMIN_LICITACAO';
}

/** Ações operacionais (ex.: reconhecer alarme): qualquer usuário logado que não esteja só lendo. */
export function podeOperar(usuario: Usuario | null | undefined): boolean {
  return Boolean(usuario) && !somenteLeitura(usuario);
}
