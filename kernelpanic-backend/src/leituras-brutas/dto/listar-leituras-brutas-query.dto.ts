import { Type } from 'class-transformer';
import { IsDateString, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';

export class ListarLeiturasBrutasQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vidEstacao?: string;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  campo?: string;

  // Só a Tecsus escolhe; o usuário de licitação vê só as estações dela.
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
  pagina = 1;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho = 50;
}