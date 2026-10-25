import { ForbiddenException } from '@nestjs/common';
import { TipoUsuario } from '../generated/prisma/client';
import type { UsuarioLogado } from './payload-jwt.interface';

export function ehTecsus(usuario: Pick<UsuarioLogado, 'tipo'>): boolean {
  return usuario.tipo === TipoUsuario.ADMIN_TECSUS;
}

/**
 * Licitação que a consulta deve filtrar. A Tecsus vê tudo e pode escolher uma
 * (undefined = todas); o usuário de licitação fica sempre preso à dele, e
 * pedir outra é 403. O filtro vale no backend, nunca só na tela.
 */
export function licitacaoDoEscopo(usuario: UsuarioLogado, licitacaoIdInformada?: string): string | undefined {
  if (ehTecsus(usuario)) return licitacaoIdInformada;
  if (licitacaoIdInformada && licitacaoIdInformada !== usuario.licitacaoId) {
    throw new ForbiddenException('Sem acesso aos dados de outra licitação');
  }
  return usuario.licitacaoId ?? undefined;
}

/** 403 quando o registro é de outra licitação que não a do usuário (a Tecsus passa sempre). */
export function garantirAcessoLicitacao(usuario: UsuarioLogado, licitacaoId: string | null): void {
  if (ehTecsus(usuario)) return;
  if (licitacaoId !== usuario.licitacaoId) {
    throw new ForbiddenException('Sem acesso aos dados de outra licitação');
  }
}
