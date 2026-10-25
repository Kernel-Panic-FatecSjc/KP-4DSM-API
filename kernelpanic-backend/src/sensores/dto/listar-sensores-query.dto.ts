import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListarSensoresQueryDto {
  @IsOptional()
  @IsString()
  busca?: string;

  // Só a Tecsus escolhe; o usuário de licitação vê os da dele.
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho = 50;
}
