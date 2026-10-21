import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';
import { StatusContrato } from '../../generated/prisma/client';

export class CriarContratoDto {
  @ApiProperty({ example: 'CTR-2026-001', maxLength: 100 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  numero!: string;

  @ApiProperty({
    example: 'Monitoramento pluviométrico municipal',
    maxLength: 2000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(2000)
  objeto!: string;

  @ApiProperty({
    example: '2026-01-01',
    format: 'date',
    description:
      'Data sem horário significa meia-noite UTC; data-hora sem fuso é interpretada como UTC.',
  })
  @IsDateString()
  inicioVigencia!: string;

  @ApiProperty({
    example: '2026-12-31',
    format: 'date',
    description:
      'Data sem horário inclui o dia inteiro até 23:59:59.999 UTC; data-hora sem fuso é interpretada como UTC.',
  })
  @IsDateString()
  fimVigencia!: string;

  @ApiProperty({
    format: 'uuid',
    description: 'Identificador de um órgão ativo',
  })
  @IsString()
  @IsNotEmpty()
  orgaoId!: string;

  @ApiPropertyOptional({
    enum: StatusContrato,
    default: StatusContrato.RASCUNHO,
  })
  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;
}
