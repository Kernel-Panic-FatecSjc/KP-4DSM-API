import { IsEnum, IsNotEmpty, IsString, Length, Matches } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
import { EsferaOrgao } from '../../generated/prisma/client';
import { IsCnpj } from './cnpj.validator';

export class CriarOrgaoDto {
  @IsString()
  @IsNotEmpty()
  @ApiProperty()
  nome!: string;

  @IsString()
  @IsCnpj({ message: 'cnpj deve ser válido' })
  @ApiProperty({ example: '11.222.333/0001-81' })
  cnpj!: string;

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
