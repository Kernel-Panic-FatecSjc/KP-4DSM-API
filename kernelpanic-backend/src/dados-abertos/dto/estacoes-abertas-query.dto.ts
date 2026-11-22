import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { StatusOperacionalEstacao } from '../../generated/prisma/client';
import { PaginacaoAbertaQueryDto } from './medidas-abertas-query.dto';

export class EstacoesAbertasQueryDto extends PaginacaoAbertaQueryDto {
  @ApiPropertyOptional({ enum: StatusOperacionalEstacao, description: 'Filtra pelo status operacional.' })
  @IsOptional()
  @IsEnum(StatusOperacionalEstacao)
  status?: StatusOperacionalEstacao;
}
