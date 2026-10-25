import type { Prisma } from '../../generated/prisma/client';

export const INCLUIR_LICITACAO_USUARIO = {
  licitacao: { select: { id: true, codigoIdentificador: true, orgaoNome: true, status: true } },
} satisfies Prisma.UsuarioInclude;

export type UsuarioComLicitacao = Prisma.UsuarioGetPayload<{ include: typeof INCLUIR_LICITACAO_USUARIO }>;

export class UsuarioRespostaDto {
  id: string;
  nome: string;
  email: string;
  tipo: string;
  ativo: boolean;
  licitacao: { id: string; codigoIdentificador: string; orgaoNome: string; status: string } | null;
  /** Só no perfil da sessão: true quando a licitação do usuário não está vigente. */
  somenteLeitura?: boolean;
  criadoEm: Date;
  atualizadoEm: Date;

  constructor(usuario: UsuarioComLicitacao, somenteLeitura?: boolean) {
    this.id = usuario.id;
    this.nome = usuario.nome;
    this.email = usuario.email;
    this.tipo = usuario.tipo;
    this.ativo = usuario.ativo;
    this.licitacao = usuario.licitacao;
    this.somenteLeitura = somenteLeitura;
    this.criadoEm = usuario.criadoEm;
    this.atualizadoEm = usuario.atualizadoEm;
  }
}
