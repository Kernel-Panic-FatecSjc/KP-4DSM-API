import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, IsUUID } from 'class-validator';

export class ListarEstacoesQueryDto {
  @ApiPropertyOptional({ description: 'Trecho do endereço' })
  @IsOptional()
  @IsString()
  regiao?: string;

  @ApiPropertyOptional({ enum: ['ATIVA', 'INATIVA'] })
  @IsOptional()
  @IsIn(['ATIVA', 'INATIVA'])
  status?: 'ATIVA' | 'INATIVA';

  @ApiPropertyOptional({ format: 'uuid', description: 'Estações com este sensor' })
  @IsOptional()
  @IsUUID('4')
  tipoParametroId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Estações vinculadas a este contrato' })
  @IsOptional()
  @IsUUID('4')
  contratoId?: string;
}