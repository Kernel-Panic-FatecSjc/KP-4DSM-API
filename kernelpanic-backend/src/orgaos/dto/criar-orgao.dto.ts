import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { EsferaOrgao } from '../../generated/prisma/client';
import { IsCnpj } from './cnpj.validator';


export class CriarOrgaoDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ default: true })
  ativo?: boolean;


  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  nome!: string;


  @IsOptional()
  @IsString()
  @IsCnpj({ message: 'cnpj deve ser válido' })
  @ApiPropertyOptional({ example: '11.222.333/0001-81', nullable: true })
  cnpj?: string | null;


  @IsEnum(EsferaOrgao)
  @ApiProperty({ enum: EsferaOrgao })
  esfera!: EsferaOrgao;


  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  municipio!: string;


  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/)
  @ApiProperty({ example: 'SP' })
  uf!: string;
}
