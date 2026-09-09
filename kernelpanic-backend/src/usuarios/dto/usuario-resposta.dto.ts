import type { Usuario } from '../../generated/prisma/client';

export class UsuarioRespostaDto {
  id: string;
  nome: string;
  email: string;
  ativo: boolean;
  criadoEm: Date;
  atualizadoEm: Date;

  constructor(usuario: Usuario) {
    this.id = usuario.id;
    this.nome = usuario.nome;
    this.email = usuario.email;
    this.ativo = usuario.ativo;
    this.criadoEm = usuario.criadoEm;
    this.atualizadoEm = usuario.atualizadoEm;
  }
}
