import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client';

export class AtualizarUsuarioDto {
  @ApiPropertyOptional({ example: 'Maria Souza', description: 'Novo nome.' })
  @IsOptional()
  @IsNotEmpty()
  nome?: string;

  @ApiPropertyOptional({ example: 'maria.souza@orgao.gov.br', description: 'Novo email. Único no sistema.' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: 'nova-senha-123', minLength: 8, description: 'Nova senha, com no mínimo 8 caracteres.' })
  @IsOptional()
  @MinLength(8)
  senha?: string;

  // Perfil e licitação só a Tecsus muda.
  @ApiPropertyOptional({ enum: TipoUsuario, description: 'Novo perfil. Só a Tecsus muda, e nunca o próprio.' })
  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;

  // null tira o usuário da licitação (só faz sentido ao virar ADMIN_TECSUS).
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    nullable: true,
    description: 'Nova licitação. Só a Tecsus muda; null tira o usuário da licitação (ao virar ADMIN_TECSUS).',
  })
  @IsOptional()
  @ValidateIf((_dto, valor) => valor !== null)
  @IsUUID('4')
  licitacaoId?: string | null;
}
