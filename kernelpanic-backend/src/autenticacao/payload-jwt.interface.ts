import type { TipoUsuario } from '../generated/prisma/client';

/** Conteúdo do token: quem é, o perfil e a licitação (nula = Tecsus). */
export interface PayloadJwt {
  sub: string;
  email: string;
  tipo: TipoUsuario;
  licitacaoId: string | null;
}

/**
 * Usuário da requisição, montado pela EstrategiaJwt a partir do banco (e não
 * só do token), para perfil, licitação e status valerem na hora em que mudam.
 * somenteLeitura: usuário de licitação que não está VIGENTE (ver
 * docs/regras-licitacao.md); a GuardaPerfil barra as escritas dele.
 */
export interface UsuarioLogado extends PayloadJwt {
  somenteLeitura: boolean;
}
