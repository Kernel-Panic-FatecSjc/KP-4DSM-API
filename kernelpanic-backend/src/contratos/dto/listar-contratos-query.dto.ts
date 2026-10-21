import { Type } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { StatusContrato } from '../../generated/prisma/client';

export const PAGINA_PADRAO = 1;
export const TAMANHO_PADRAO = 10;

export class ListarContratosQueryDto {
  @ApiPropertyOptional({ description: 'Busca por número, objeto ou nome do órgão' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ enum: StatusContrato })
  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsString()
  orgaoId?: string;

  @ApiPropertyOptional({ minimum: 1, default: PAGINA_PADRAO })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = PAGINA_PADRAO;

  @ApiPropertyOptional({ minimum: 1, maximum: 100, default: TAMANHO_PADRAO })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  tamanho = TAMANHO_PADRAO;
}
