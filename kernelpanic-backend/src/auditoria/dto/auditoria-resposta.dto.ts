import type { Prisma } from '../../generated/prisma/client';

type RegistroComUsuario = Pick<Prisma.LogAuditoriaModel, 'id' | 'criadoEm' | 'acao' | 'entidade' | 'entidadeId' | 'detalhes'> & {
  usuario: { id: string; nome: string } | null;
};

const CHAVES_SENSIVEIS = new Set(['senha', 'senhaHash', 'password', 'token', 'access_token', 'email']);

function removerDadosSensiveis(valor: unknown): unknown {
  if (Array.isArray(valor)) return valor.map(removerDadosSensiveis);
  if (!valor || typeof valor !== 'object') return valor;

  return Object.fromEntries(
    Object.entries(valor)
      .filter(([chave]) => !CHAVES_SENSIVEIS.has(chave.toLowerCase()))
      .map(([chave, conteudo]) => [chave, removerDadosSensiveis(conteudo)]),
  );
}

export class AuditoriaRespostaDto {
  id: string;
  criadoEm: Date;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  detalhes: unknown;
  usuario: { id: string; nome: string } | null;

  constructor(registro: RegistroComUsuario) {
    this.id = registro.id;
    this.criadoEm = registro.criadoEm;
    this.acao = registro.acao;
    this.entidade = registro.entidade;
    this.entidadeId = registro.entidadeId;
    this.detalhes = removerDadosSensiveis(registro.detalhes);
    this.usuario = registro.usuario;
  }
}