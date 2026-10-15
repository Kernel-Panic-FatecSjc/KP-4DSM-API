import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsDateString,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
} from 'class-validator';
import { StatusContrato } from '../../generated/prisma/client';

const removerEspacos = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class CriarContratoDto {
  @ApiProperty({
    example: 'CTR-2026-001',
    description: 'Numero unico do contrato',
  })
  @Transform(removerEspacos)
  @IsString()
  @IsNotEmpty()
  numero!: string;

  @ApiProperty({ example: 'Monitoramento hidrometeorologico municipal' })
  @Transform(removerEspacos)
  @IsString()
  @IsNotEmpty()
  objeto!: string;

  @ApiProperty({
    example: '2026-01-01',
    description: 'Inicio da vigencia (ISO 8601)',
  })
  @IsDateString()
  inicioVigencia!: string;

  @ApiProperty({
    example: '2026-12-31',
    description:
      'Fim da vigencia (ISO 8601). Deve ser maior ou igual ao inicio',
  })
  @IsDateString()
  fimVigencia!: string;

  @ApiProperty({
    enum: StatusContrato,
    required: false,
    default: StatusContrato.RASCUNHO,
    description: 'Status inicial. SUSPENSO nao e aceito na criacao',
  })
  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;

  @ApiProperty({
    example: '2d0f7b6f-1a40-4a65-9a4f-650bbafc648e',
    description: 'Orgao existente e ativo',
  })
  @IsUUID('4')
  orgaoId!: string;
}
