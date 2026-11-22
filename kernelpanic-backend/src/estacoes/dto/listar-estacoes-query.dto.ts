import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsIn, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListarEstacoesQueryDto {
  @ApiPropertyOptional({ example: 'Centro', description: 'Trecho do endereço.' })
  @IsOptional()
  @IsString()
  regiao?: string;

  @ApiPropertyOptional({ example: 'Centro', description: 'Trecho do nome ou do vid.' })
  @IsOptional()
  @IsString()
  busca?: string;

  @ApiPropertyOptional({ enum: ['ATIVA', 'INATIVA'], description: 'Status operacional.' })
  @IsOptional()
  @IsIn(['ATIVA', 'INATIVA'])
  status?: 'ATIVA' | 'INATIVA';

  @ApiPropertyOptional({ format: 'uuid', example: '11111111-1111-4111-8111-111111111111', description: 'Estações com este sensor.' })
  @IsOptional()
  @IsUUID('4')
  tipoParametroId?: string;

  @ApiPropertyOptional({
    format: 'uuid',
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Só a Tecsus escolhe; o usuário de licitação vê a dele.',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50, example: 50, description: 'Itens por página.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho = 50;
}
