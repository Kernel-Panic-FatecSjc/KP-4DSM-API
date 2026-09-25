import type { Usuario } from './api';

export function podeInativarUsuario(usuario: Usuario, usuarioLogadoId: string | null): boolean {
  return usuario.ativo && usuario.id !== usuarioLogadoId;
}
