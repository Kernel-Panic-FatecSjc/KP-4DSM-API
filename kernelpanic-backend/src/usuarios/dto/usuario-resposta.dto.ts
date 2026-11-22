import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusLicitacao, TipoUsuario, type Prisma } from '../../generated/prisma/client';

export const INCLUIR_LICITACAO_USUARIO = {
  licitacao: { select: { id: true, codigoIdentificador: true, orgaoNome: true, status: true } },
} satisfies Prisma.UsuarioInclude;

export type UsuarioComLicitacao = Prisma.UsuarioGetPayload<{ include: typeof INCLUIR_LICITACAO_USUARIO }>;

export class LicitacaoDoUsuarioDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id!: string;

  @ApiProperty({ example: 'PE-012/2026', description: 'Código identificador da licitação.' })
  codigoIdentificador!: string;

  @ApiProperty({ example: 'Prefeitura de São José dos Campos', description: 'Nome do órgão contratante.' })
  orgaoNome!: string;

  @ApiProperty({ enum: StatusLicitacao, description: 'Situação da licitação.' })
  status!: string;
}

export class UsuarioRespostaDto {
  @ApiProperty({ example: '8f14e45f-ceea-4f67-9d6b-0c6f4c1a2b3d' })
  id: string;

  @ApiProperty({ example: 'Maria Souza' })
  nome: string;

  @ApiProperty({ example: 'maria.souza@orgao.gov.br' })
  email: string;

  @ApiProperty({ enum: TipoUsuario, description: 'Perfil do usuário.' })
  tipo: string;

  @ApiProperty({ example: true, description: 'false quando o usuário foi inativado.' })
  ativo: boolean;

  @ApiProperty({ type: LicitacaoDoUsuarioDto, nullable: true, description: 'Licitação do usuário; null para a Tecsus.' })
  licitacao: { id: string; codigoIdentificador: string; orgaoNome: string; status: string } | null;

  /** Só no perfil da sessão: true quando a licitação do usuário não está vigente. */
  @ApiPropertyOptional({ example: false, description: 'Só no perfil da sessão: true quando a licitação do usuário não está vigente.' })
  somenteLeitura?: boolean;

  @ApiProperty({ example: '2026-11-08T14:00:00.000Z', description: 'Data de criação (ISO 8601, UTC).' })
  criadoEm: Date;

  @ApiProperty({ example: '2026-11-08T14:00:00.000Z', description: 'Data da última alteração (ISO 8601, UTC).' })
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
