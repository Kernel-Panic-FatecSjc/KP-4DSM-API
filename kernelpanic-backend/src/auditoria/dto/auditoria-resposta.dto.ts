import type { LogAuditoria } from '../../generated/prisma/client';

type RegistroComUsuario = LogAuditoria & {
  usuario: { id: string; nome: string; email: string } | null;
};

export class AuditoriaRespostaDto {
  id: string;
  criadoEm: Date;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  detalhes: unknown;
  usuario: { id: string; nome: string; email: string } | null;

  constructor(registro: RegistroComUsuario) {
    this.id = registro.id;
    this.criadoEm = registro.criadoEm;
    this.acao = registro.acao;
    this.entidade = registro.entidade;
    this.entidadeId = registro.entidadeId;
    this.detalhes = registro.detalhes;
    this.usuario = registro.usuario;
  }
}