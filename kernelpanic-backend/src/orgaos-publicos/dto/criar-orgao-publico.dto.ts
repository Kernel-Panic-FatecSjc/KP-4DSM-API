import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
} from 'class-validator';
import { EsferaOrgao } from '../../generated/prisma/client';

export class CriarOrgaoPublicoDto {
  @ApiProperty({ maxLength: 200 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(200)
  nome!: string;

  @ApiPropertyOptional({ example: '12345678000190' })
  @IsOptional()
  @IsString()
  @Matches(/^\d{14}$/, { message: 'cnpj deve conter 14 dígitos' })
  cnpj?: string;

  @ApiProperty({ enum: EsferaOrgao })
  @IsEnum(EsferaOrgao)
  esfera!: EsferaOrgao;

  @ApiProperty()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  municipio!: string;

  @ApiProperty({ minLength: 2, maxLength: 2, example: 'SP' })
  @IsString()
  @IsNotEmpty()
  @Length(2, 2)
  uf!: string;
}
