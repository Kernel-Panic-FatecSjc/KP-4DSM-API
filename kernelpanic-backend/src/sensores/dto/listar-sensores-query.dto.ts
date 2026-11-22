import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListarSensoresQueryDto {
  @ApiPropertyOptional({ example: 'chuva', description: 'Trecho do nome do sensor.' })
  @IsOptional()
  @IsString()
  busca?: string;

  // Só a Tecsus escolhe; o usuário de licitação vê os da dele.
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Só a Tecsus escolhe; o usuário de licitação vê os da dele.',
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
