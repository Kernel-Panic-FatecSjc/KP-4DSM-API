import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, Min } from 'class-validator';

export class ListarAuditoriaQueryDto {
  @IsOptional()
  @IsString()
  acao?: string;

  @IsOptional()
  @IsString()
  entidade?: string;

  @IsOptional()
  @IsString()
  entidadeId?: string;

  @IsOptional()
  @IsString()
  usuarioId?: string;

  // Só a Tecsus escolhe; o admin da licitação lê sempre a dele.
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  @IsOptional()
  @IsDateString()
  de?: string;

  @IsOptional()
  @IsDateString()
  ate?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho?: number = 50;
}