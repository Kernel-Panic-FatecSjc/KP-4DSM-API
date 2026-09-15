import { Type } from 'class-transformer';
import { IsDateString, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SeveridadeAlerta, StatusAlarme } from '../../generated/prisma/client';

export class ListarAlarmesQueryDto {
  @IsOptional()
  @IsUUID()
  estacaoId?: string;

  @IsOptional()
  @IsUUID()
  tipoParametroId?: string;

  @IsOptional()
  @IsEnum(SeveridadeAlerta)
  severidade?: SeveridadeAlerta;

  @IsOptional()
  @IsEnum(StatusAlarme)
  status?: StatusAlarme;

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
