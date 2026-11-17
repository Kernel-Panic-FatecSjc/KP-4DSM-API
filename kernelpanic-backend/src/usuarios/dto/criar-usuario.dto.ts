import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsUUID, MinLength } from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client';

export class CriarUsuarioDto {
  @ApiProperty({ example: 'Maria Souza', description: 'Nome completo do usuário.' })
  @IsNotEmpty()
  nome!: string;

  @ApiProperty({ example: 'maria.souza@orgao.gov.br', description: 'Email de login. Único no sistema.' })
  @IsEmail()
  email!: string;

  @ApiProperty({ example: 'senha-segura-123', minLength: 8, description: 'Senha inicial, com no mínimo 8 caracteres.' })
  @MinLength(8)
  senha!: string;

  // Padrão USUARIO_LICITACAO. O admin da licitação só cria esse perfil.
  @ApiPropertyOptional({
    enum: TipoUsuario,
    default: TipoUsuario.USUARIO_LICITACAO,
    description: 'Perfil. Padrão USUARIO_LICITACAO; o admin da licitação só cria esse perfil.',
  })
  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;

  // Obrigatória para os perfis de licitação e proibida para ADMIN_TECSUS. O
  // admin da licitação pode omitir: vale a dele.
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Licitação do usuário. Obrigatória para os perfis de licitação e proibida para ADMIN_TECSUS; o admin da licitação pode omitir (vale a dele).',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;
}
