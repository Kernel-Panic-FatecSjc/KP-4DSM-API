import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListarEstacoesQueryDto {
  @ApiPropertyOptional({ description: 'Trecho do endereço' })
  @IsOptional()
  @IsString()
  regiao?: string;

  @ApiPropertyOptional({ description: 'Trecho do nome ou do vid' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ enum: ['ATIVA', 'INATIVA'] })
  @IsOptional()
  @IsIn(['ATIVA', 'INATIVA'])
  status?: 'ATIVA' | 'INATIVA';

  @ApiPropertyOptional({ format: 'uuid', description: 'Estações com este sensor' })
  @IsOptional()
  @IsUUID('4')
  tipoParametroId?: string;

  @ApiPropertyOptional({ format: 'uuid', description: 'Só a Tecsus escolhe; o usuário de licitação vê a dele' })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho = 50;
}
