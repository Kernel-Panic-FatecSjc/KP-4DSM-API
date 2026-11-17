import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsDateString, IsEnum, IsOptional, IsUUID } from 'class-validator';
import { SeveridadeAlerta, StatusAlarme } from '../../generated/prisma/client';
import { PaginacaoAbertaQueryDto } from './medidas-abertas-query.dto';

export class AlarmesAbertosQueryDto extends PaginacaoAbertaQueryDto {
  @ApiProperty({ example: '2026-11-01', description: 'Início inclusivo (data ou instante ISO 8601, UTC).' })
  @IsDateString({ strict: true })
  de!: string;

  @ApiProperty({ example: '2026-11-07', description: 'Fim inclusivo (data ou instante ISO 8601, UTC). Período de até 366 dias.' })
  @IsDateString({ strict: true })
  ate!: string;

  @ApiPropertyOptional({ description: 'Limita a uma estação.' })
  @IsOptional()
  @IsUUID('4')
  estacaoId?: string;

  @ApiPropertyOptional({ enum: SeveridadeAlerta })
  @IsOptional()
  @IsEnum(SeveridadeAlerta)
  severidade?: SeveridadeAlerta;

  @ApiPropertyOptional({ enum: StatusAlarme })
  @IsOptional()
  @IsEnum(StatusAlarme)
  status?: StatusAlarme;
}
