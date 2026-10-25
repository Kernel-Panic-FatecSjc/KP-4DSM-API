import { Transform, Type } from 'class-transformer';
import { IsBoolean, IsEnum, IsInt, IsOptional, IsUUID, Max, Min } from 'class-validator';
import { SeveridadeAlerta } from '../../generated/prisma/client';
import { RegiaoQueryDto } from '../../regiao/regiao';

function paraBooleano({ value }: { value: unknown }): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  return value;
}

/** Região (visitante) e, para a Tecsus, a licitação. */
export class FiltrosAlertasQueryDto extends RegiaoQueryDto {
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;
}

export class ListarAlertasQueryDto extends FiltrosAlertasQueryDto {
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
  @Transform(paraBooleano)
  @IsBoolean()
  ativo?: boolean;

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
