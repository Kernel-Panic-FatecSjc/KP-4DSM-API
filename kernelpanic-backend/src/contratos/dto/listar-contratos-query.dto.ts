import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { StatusContrato } from '../../generated/prisma/client';

export const PAGINA_PADRAO = 1;
export const TAMANHO_PADRAO = 50;
export const TAMANHO_MAXIMO = 200;

const removerEspacos = ({ value }: { value: unknown }) =>
  typeof value === 'string' ? value.trim() : value;

export class ListarContratosQueryDto {
  @ApiProperty({
    enum: StatusContrato,
    required: false,
    description: 'Filtra pelo status do contrato',
  })
  @IsOptional()
  @IsEnum(StatusContrato)
  status?: StatusContrato;

  @ApiProperty({
    example: '2d0f7b6f-1a40-4a65-9a4f-650bbafc648e',
    required: false,
    description: 'Filtra pelo orgao contratante (UUID)',
  })
  @IsOptional()
  @IsUUID('4')
  orgaoId?: string;

  @ApiProperty({
    example: 'CTR-2026',
    required: false,
    description:
      'Busca parcial (sem diferenciar maiusculas/minusculas) por numero do contrato, objeto ou nome do orgao',
  })
  @Transform(removerEspacos)
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiProperty({
    required: false,
    type: Number,
    minimum: 1,
    default: PAGINA_PADRAO,
    description: 'Numero da pagina (comeca em 1)',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  pagina?: number = PAGINA_PADRAO;

  @ApiProperty({
    required: false,
    type: Number,
    minimum: 1,
    maximum: TAMANHO_MAXIMO,
    default: TAMANHO_PADRAO,
    description: 'Quantidade de itens por pagina',
  })
  @Type(() => Number)
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(TAMANHO_MAXIMO)
  tamanho?: number = TAMANHO_PADRAO;
}
