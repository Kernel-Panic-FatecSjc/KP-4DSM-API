import type { Prisma } from '../../generated/prisma/client';
import { isIP } from 'node:net';

type RegistroComUsuario = Pick<Prisma.LogAuditoriaModel, 'id' | 'criadoEm' | 'acao' | 'entidade' | 'entidadeId' | 'detalhes' | 'enderecoIp'> & {
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

function mascararIp(enderecoIp: string | null): string | null {
  if (!enderecoIp) return null;

  const endereco = enderecoIp.replace(/^::ffff:/i, '');
  if (isIP(endereco) === 4) {
    return `${endereco.split('.').slice(0, 2).join('.')}.*.*`;
  }
  if (isIP(endereco) === 6) {
    return `${endereco.split(':').filter(Boolean).slice(0, 3).join(':')}:*`;
  }
  return '***';
}

export class AuditoriaRespostaDto {
  id: string;
  criadoEm: Date;
  acao: string;
  entidade: string;
  entidadeId: string | null;
  enderecoIp: string | null;
  detalhes: unknown;
  usuario: { id: string; nome: string } | null;

  constructor(registro: RegistroComUsuario) {
    this.id = registro.id;
    this.criadoEm = registro.criadoEm;
    this.acao = registro.acao;
    this.entidade = registro.entidade;
    this.entidadeId = registro.entidadeId;
    this.enderecoIp = mascararIp(registro.enderecoIp);
    const detalhes = removerDadosSensiveis(registro.detalhes);
    this.detalhes = this.enderecoIp
      ? {
          ...(detalhes && typeof detalhes === 'object' && !Array.isArray(detalhes)
            ? detalhes
            : { dados: detalhes }),
          'IP de origem (mascarado)': this.enderecoIp,
        }
      : detalhes;
    this.usuario = registro.usuario;
  }
}