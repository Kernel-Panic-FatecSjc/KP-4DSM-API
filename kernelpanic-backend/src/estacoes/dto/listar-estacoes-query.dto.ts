import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListarEstacoesQueryDto {
  @ApiPropertyOptional({ description: 'Filtra pelo endereço/região da estação', example: 'Norte' })
  @IsOptional()
  @IsString()
  regiao?: string;

  @ApiPropertyOptional({ description: 'Filtra pelo status operacional', enum: ['ATIVA', 'INATIVA'] })
  @IsOptional()
  @IsIn(['ATIVA', 'INATIVA'])
  status?: 'ATIVA' | 'INATIVA';

  @ApiPropertyOptional({ description: 'Filtra estações que possuem este tipo de sensor/parâmetro', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  tipoParametroId?: string;

  @ApiPropertyOptional({ description: 'Filtra estações vinculadas ao contrato informado', format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  contratoId?: string;
}
