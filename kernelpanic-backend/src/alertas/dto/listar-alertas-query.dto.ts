import { ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', description: 'Licitação. Só a Tecsus escolhe.' })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;
}

export class ListarAlertasQueryDto extends FiltrosAlertasQueryDto {
  @ApiPropertyOptional({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10', description: 'Filtra por estação.' })
  @IsOptional()
  @IsUUID()
  estacaoId?: string;

  @ApiPropertyOptional({ example: '11111111-1111-4111-8111-111111111111', description: 'Filtra por tipo de parâmetro (sensor).' })
  @IsOptional()
  @IsUUID()
  tipoParametroId?: string;

  @ApiPropertyOptional({ enum: SeveridadeAlerta, description: 'Filtra por severidade.' })
  @IsOptional()
  @IsEnum(SeveridadeAlerta)
  severidade?: SeveridadeAlerta;

  @ApiPropertyOptional({ example: true, description: 'Filtra por alertas ativos (`true`) ou inativos (`false`).' })
  @IsOptional()
  @Transform(paraBooleano)
  @IsBoolean()
  ativo?: boolean;

  @ApiPropertyOptional({ minimum: 1, default: 1, example: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  pagina?: number = 1;

  @ApiPropertyOptional({ minimum: 1, maximum: 200, default: 50, example: 50, description: 'Itens por página.' })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(200)
  tamanho?: number = 50;
}
