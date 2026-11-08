import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListarAuditoriaQueryDto {
  @ApiPropertyOptional({ example: 'usuarios.criar', description: 'Ação registrada.' })
  @IsOptional()
  @IsString()
  acao?: string;

  @ApiPropertyOptional({ example: 'Usuario', description: 'Entidade afetada.' })
  @IsOptional()
  @IsString()
  entidade?: string;

  @ApiPropertyOptional({ example: '8f14e45f-ceea-4f67-9d6b-0c6f4c1a2b3d', description: 'Id da entidade afetada.' })
  @IsOptional()
  @IsString()
  entidadeId?: string;

  @ApiPropertyOptional({ example: '8f14e45f-ceea-4f67-9d6b-0c6f4c1a2b3d', description: 'Usuário que fez a ação.' })
  @IsOptional()
  @IsString()
  usuarioId?: string;

  // Só a Tecsus escolhe; o admin da licitação lê sempre a dele.
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Licitação. Só a Tecsus escolhe; o admin da licitação lê sempre a dele.',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @ApiPropertyOptional({ example: '2026-11-01', description: 'Início do período (data ou instante ISO 8601). Obrigatório na exportação.' })
  @IsOptional()
  @IsDateString()
  de?: string;

  @ApiPropertyOptional({ example: '2026-11-07', description: 'Fim do período (data ou instante ISO 8601). Obrigatório na exportação.' })
  @IsOptional()
  @IsDateString()
  ate?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50, example: 50, description: 'Itens por página (não vale na exportação).' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho?: number = 50;
}
