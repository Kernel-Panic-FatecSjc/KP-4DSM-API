import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsEnum, IsInt, IsOptional, IsString, Max, Min } from 'class-validator';
import { EsferaOrgao, StatusLicitacao } from '../../generated/prisma/client';

export const PAGINA_PADRAO = 1;
export const TAMANHO_PADRAO = 10;

export class ListarLicitacoesQueryDto {
  @ApiPropertyOptional({ description: 'Busca por código, processo, contrato, objeto, órgão ou município' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ enum: StatusLicitacao })
  @IsOptional()
  @IsEnum(StatusLicitacao)
  status?: StatusLicitacao;

  @ApiPropertyOptional({ enum: EsferaOrgao })
  @IsOptional()
  @IsEnum(EsferaOrgao)
  esfera?: EsferaOrgao;

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
