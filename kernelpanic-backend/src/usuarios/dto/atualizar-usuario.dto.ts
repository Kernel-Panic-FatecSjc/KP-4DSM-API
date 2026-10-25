import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsUUID, MinLength, ValidateIf } from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client';

export class AtualizarUsuarioDto {
  @IsOptional()
  @IsNotEmpty()
  nome?: string;

  @IsOptional()
  @IsEmail()
  email?: string;

  @IsOptional()
  @MinLength(8)
  senha?: string;

  // Perfil e licitação só a Tecsus muda.
  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;

  // null tira o usuário da licitação (só faz sentido ao virar ADMIN_TECSUS).
  @IsOptional()
  @ValidateIf((_dto, valor) => valor !== null)
  @IsUUID('4')
  licitacaoId?: string | null;
}
