import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';

/**
 * Quem fez a ação, para a trilha: o usuário e a licitação dele (nula = Tecsus,
 * ou visitante sem login). É a licitação do autor que define quem pode ler o
 * registro depois.
 */
export function autoria(usuario: UsuarioLogado | null | undefined): { usuarioId?: string; licitacaoId?: string | null } {
  if (!usuario) return {};
  return { usuarioId: usuario.sub, licitacaoId: usuario.licitacaoId };
}
