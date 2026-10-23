import {
  IsBoolean,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Length,
  Matches,
} from 'class-validator';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EsferaOrgao } from '../../generated/prisma/client';
import { IsCnpj } from './cnpj.validator';


export class AtualizarOrgaoDto {
  @IsOptional()
  @IsBoolean()
  @ApiPropertyOptional({ description: 'Reativa ou desativa o órgão' })
  ativo?: boolean;


  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional()
  nome?: string;


  @IsOptional()
  @IsString()
  @IsCnpj({ message: 'cnpj deve ser válido' })
  @ApiPropertyOptional({ example: '11.222.333/0001-81', nullable: true })
  cnpj?: string | null;


  @IsOptional()
  @IsEnum(EsferaOrgao)
  @ApiPropertyOptional({ enum: EsferaOrgao })
  esfera?: EsferaOrgao;


  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @ApiPropertyOptional()
  municipio?: string;


  @IsOptional()
  @IsString()
  @Length(2, 2)
  @Matches(/^[A-Za-z]{2}$/)
  @ApiPropertyOptional({ example: 'SP' })
  uf?: string;
}
