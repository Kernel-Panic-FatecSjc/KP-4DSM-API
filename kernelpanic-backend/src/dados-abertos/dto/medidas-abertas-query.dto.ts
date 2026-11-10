import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsDateString, IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';
import { GRANULARIDADES_HISTORICO, type GranularidadeHistorico } from '../../relatorios/dto/historico-climatico-query.dto';
import { FORMATOS_DADOS_ABERTOS, type FormatoDadosAbertos } from '../formato';

export const TAMANHO_PAGINA_PADRAO = 100;
export const TAMANHO_PAGINA_MAXIMO = 1000;

export class PaginacaoAbertaQueryDto {
  @ApiPropertyOptional({ enum: FORMATOS_DADOS_ABERTOS, description: 'Formato da resposta. Sem ele vale o header Accept; sem nenhum, JSON.' })
  @IsOptional()
  @IsIn(FORMATOS_DADOS_ABERTOS)
  formato?: FormatoDadosAbertos;

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: TAMANHO_PAGINA_MAXIMO, default: TAMANHO_PAGINA_PADRAO, example: 100 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(TAMANHO_PAGINA_MAXIMO)
  tamanhoPagina?: number = TAMANHO_PAGINA_PADRAO;
}

export class MedidasAbertasQueryDto extends PaginacaoAbertaQueryDto {
  @ApiProperty({ example: '2026-11-01', description: 'Início inclusivo (data ou instante ISO 8601, UTC).' })
  @IsDateString({ strict: true })
  de!: string;

  @ApiProperty({ example: '2026-11-07', description: 'Fim inclusivo (data ou instante ISO 8601, UTC). Data sem hora vai até 23:59:59.999.' })
  @IsDateString({ strict: true })
  ate!: string;

  @ApiProperty({ enum: GRANULARIDADES_HISTORICO, example: 'hora', description: '`hora`: período de até 31 dias; `dia`: até 366 dias.' })
  @IsIn(GRANULARIDADES_HISTORICO)
  granularidade!: GranularidadeHistorico;

  @ApiPropertyOptional({ description: 'Limita a uma estação.' })
  @IsOptional()
  @IsUUID('4')
  estacaoId?: string;

  @ApiPropertyOptional({ example: 'Temperatura', description: 'Nome do parâmetro (sem diferenciar maiúsculas).' })
  @IsOptional()
  @IsString()
  parametro?: string;
}
