import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client';

export class BuscarUsuariosQueryDto {
  @IsOptional()
  @IsString()
  busca?: string;

  // Só a Tecsus escolhe; o admin da licitação vê sempre a dele.
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;
}
