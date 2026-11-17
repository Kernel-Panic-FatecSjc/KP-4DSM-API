import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';
import { AgregacaoParametro } from '../../generated/prisma/client';
import { UnidadeSensor } from '../unidade-sensor';
import { aparar, MENSAGEM_UNIDADE } from './criar-sensor.dto';

export class AtualizarSensorDto {
  @ApiPropertyOptional({ example: 'Pluviômetro', maxLength: 120, description: 'Novo nome. Único dentro da licitação.' })
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @ApiPropertyOptional({ enum: UnidadeSensor, example: UnidadeSensor.MILIMETRO, description: 'Nova unidade, do catálogo de `GET /sensores/unidades`.' })
  @IsOptional()
  @IsEnum(UnidadeSensor, { message: MENSAGEM_UNIDADE })
  unidade?: UnidadeSensor;

  @ApiPropertyOptional({ enum: AgregacaoParametro, description: 'Nova regra de agregação dos relatórios.' })
  @IsOptional()
  @IsEnum(AgregacaoParametro)
  agregacao?: AgregacaoParametro;

  @ApiPropertyOptional({ example: 0.2, description: 'Novo fator que multiplica a leitura bruta. Não pode ser zero.' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @NotEquals(0, { message: 'fator não pode ser zero' })
  fator?: number;

  @ApiPropertyOptional({ example: 0, description: 'Novo ganho somado à leitura bruta.' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  ganho?: number;

  // Faixa física válida da leitura, inclusiva e opcional: fora dela a ingestão
  // não grava a medida (ver leituras_erro). null limpa o limite.
  @ApiPropertyOptional({ type: Number, example: 0, nullable: true, description: 'Novo menor valor físico válido (inclusivo). null remove o limite.' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  valorMinimo?: number | null;

  @ApiPropertyOptional({ type: Number, example: 500, nullable: true, description: 'Novo maior valor físico válido (inclusivo). null remove o limite.' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  valorMaximo?: number | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, example: { modelo: 'PL-100' }, description: 'Novos metadados livres.' })
  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;
}
