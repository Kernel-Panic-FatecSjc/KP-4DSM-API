import { IsEmail, IsEnum, IsNotEmpty, IsOptional, IsUUID, MinLength } from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client';

export class CriarUsuarioDto {
  @IsNotEmpty()
  nome!: string;

  @IsEmail()
  email!: string;

  @MinLength(8)
  senha!: string;

  // Padrão USUARIO_LICITACAO. O admin da licitação só cria esse perfil.
  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;

  // Obrigatória para os perfis de licitação e proibida para ADMIN_TECSUS. O
  // admin da licitação pode omitir: vale a dele.
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;
}
