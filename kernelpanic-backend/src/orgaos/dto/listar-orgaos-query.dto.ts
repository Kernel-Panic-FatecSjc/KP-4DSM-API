import { IsBoolean, IsEnum, IsOptional, IsString } from 'class-validator';
import { Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { EsferaOrgao } from '../../generated/prisma/client';

export class ListarOrgaosQueryDto {
  @IsOptional()
  @IsString()
  @ApiPropertyOptional()
  busca?: string;

  @IsOptional()
  @IsEnum(EsferaOrgao)
  @ApiPropertyOptional({ enum: EsferaOrgao })
  esfera?: EsferaOrgao;

  @IsOptional()
  @Transform(({ value }) =>
    value === 'true' ? true : value === 'false' ? false : value,
  )
  @IsBoolean()
  @ApiPropertyOptional({ type: Boolean })
  ativo?: boolean;
}
