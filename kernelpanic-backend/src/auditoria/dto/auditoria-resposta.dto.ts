import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../../generated/prisma/client';
import { isIP } from 'node:net';

type RegistroComUsuario = Pick<Prisma.LogAuditoriaModel, 'id' | 'criadoEm' | 'acao' | 'entidade' | 'entidadeId' | 'detalhes' | 'enderecoIp' | 'licitacaoId'> & {
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

export class UsuarioDaAuditoriaDto {
  @ApiProperty({ example: '8f14e45f-ceea-4f67-9d6b-0c6f4c1a2b3d' })
  id!: string;

  @ApiProperty({ example: 'Maria Souza' })
  nome!: string;
}

export class AuditoriaRespostaDto {
  @ApiProperty({ example: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' })
  id: string;
  @ApiProperty({ example: '2026-11-08T14:00:00.000Z', description: 'Momento do registro (ISO 8601, UTC).' })
  criadoEm: Date;
  @ApiProperty({ example: 'usuarios.criar', description: 'Ação registrada.' })
  acao: string;
  @ApiProperty({ example: 'Usuario', description: 'Entidade afetada.' })
  entidade: string;
  @ApiProperty({ type: String, example: '8f14e45f-ceea-4f67-9d6b-0c6f4c1a2b3d', nullable: true, description: 'Id da entidade afetada, quando há.' })
  entidadeId: string | null;
  @ApiProperty({ type: String, example: '189.12.*.*', nullable: true, description: 'IP de origem, mascarado.' })
  enderecoIp: string | null;
  @ApiProperty({ type: 'object', additionalProperties: true, nullable: true, example: { campos: ['nome'] }, description: 'Detalhes da ação, sem senha, token nem email.' })
  detalhes: unknown;
  @ApiProperty({ type: UsuarioDaAuditoriaDto, nullable: true, description: 'Quem fez a ação; null para visitante ou sistema.' })
  usuario: { id: string; nome: string } | null;
  /** Licitação de quem fez a ação; nula = Tecsus ou visitante. */
  @ApiProperty({ type: String, example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', nullable: true, description: 'Licitação de quem fez a ação; null para Tecsus ou visitante.' })
  licitacaoId: string | null;

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
    this.licitacaoId = registro.licitacaoId;
  }
}