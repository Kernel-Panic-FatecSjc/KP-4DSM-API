import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsString, IsUUID, Max, MaxLength, Min } from 'class-validator';
import { MotivoLeituraErro } from '../../generated/prisma/client';

export class ListarLeiturasErroQueryDto {
  @IsOptional()
  @IsString()
  @MaxLength(64)
  vidEstacao?: string;

  @IsOptional()
  @IsEnum(MotivoLeituraErro)
  motivo?: MotivoLeituraErro;

  // Só a Tecsus escolhe; o usuário de licitação vê só as da dele.
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
