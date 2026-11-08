import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, IsUUID } from 'class-validator';
import { TipoUsuario } from '../../generated/prisma/client';

export class BuscarUsuariosQueryDto {
  @ApiPropertyOptional({ example: 'maria', description: 'Texto buscado no nome ou no email.' })
  @IsOptional()
  @IsString()
  busca?: string;

  // Só a Tecsus escolhe; o admin da licitação vê sempre a dele.
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Filtra por licitação. Só a Tecsus escolhe; o admin da licitação vê sempre a dele.',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @ApiPropertyOptional({ enum: TipoUsuario, description: 'Filtra por perfil.' })
  @IsOptional()
  @IsEnum(TipoUsuario)
  tipo?: TipoUsuario;
}
