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

export class AtualizarContratoDto {
  @ApiProperty({ example: 'CTR-2026-001-A', required: false })
  @Transform(removerEspacos)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  numero?: string;

  @ApiProperty({
    example: 'Monitoramento hidrometeorologico municipal ampliado',
    required: false,
  })
  @Transform(removerEspacos)
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  objeto?: string;

  @ApiProperty({ example: '2026-01-01', required: false })
  @IsOptional()
  @IsDateString()
  inicioVigencia?: string;

  @ApiProperty({ example: '2027-12-31', required: false })
  @IsOptional()
  @IsDateString()
  fimVigencia?: string;

  @ApiProperty({
    enum: StatusContrato,
    required: false,
    description:
      'Novo status. RASCUNHO->ATIVO|ENCERRADO, ATIVO->SUSPENSO|ENCERRADO, SUSPENSO->ATIVO|ENCERRADO',
  })
  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;

  @ApiProperty({
    example: '2d0f7b6f-1a40-4a65-9a4f-650bbafc648e',
    required: false,
  })
  @IsOptional()
  @IsUUID('4')
  orgaoId?: string;
}
