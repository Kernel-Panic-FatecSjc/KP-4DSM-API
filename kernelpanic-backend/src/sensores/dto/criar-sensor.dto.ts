import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, NotEquals } from 'class-validator';
import { AgregacaoParametro } from '../../generated/prisma/client';
import { UnidadeSensor } from '../unidade-sensor';

// Sem isso, um nome só com espaços passaria pelo @IsNotEmpty e "Pluviômetro "
// escaparia da checagem de nome repetido.
export function aparar({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export const MENSAGEM_UNIDADE = `unidade deve ser uma de: ${Object.values(UnidadeSensor).join(', ')}`;

export class CriarSensorDto {
  @ApiProperty({ example: 'Pluviômetro', maxLength: 120, description: 'Nome do sensor. Único dentro da licitação.' })
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @ApiProperty({ enum: UnidadeSensor, example: UnidadeSensor.MILIMETRO, description: 'Unidade de medida, do catálogo de `GET /sensores/unidades`.' })
  @IsEnum(UnidadeSensor, { message: MENSAGEM_UNIDADE })
  unidade!: UnidadeSensor;

  @ApiPropertyOptional({ enum: AgregacaoParametro, default: AgregacaoParametro.MEDIA, description: 'Regra dos relatórios: SOMA (ex.: precipitação em mm) ou MEDIA.' })
  @IsOptional()
  @IsEnum(AgregacaoParametro)
  agregacao?: AgregacaoParametro;

  // O fator multiplica a leitura bruta: zero apagaria toda medição do sensor.
  @ApiProperty({ example: 0.2, description: 'Fator que multiplica a leitura bruta do dispositivo. Não pode ser zero.' })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @NotEquals(0, { message: 'fator não pode ser zero' })
  fator!: number;

  @ApiProperty({ example: 0, description: 'Ganho somado à leitura bruta, depois do fator.' })
  @IsNumber({ allowInfinity: false, allowNaN: false })
  ganho!: number;

  // Faixa física válida da leitura, inclusiva e opcional: fora dela a ingestão
  // não grava a medida (ver leituras_erro). null limpa o limite.
  @ApiPropertyOptional({ type: Number, example: 0, nullable: true, description: 'Menor valor físico válido (inclusivo), na unidade do sensor. Fora da faixa a leitura vai para leituras_erro.' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  valorMinimo?: number | null;

  @ApiPropertyOptional({ type: Number, example: 500, nullable: true, description: 'Maior valor físico válido (inclusivo), na unidade do sensor.' })
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  valorMaximo?: number | null;

  @ApiPropertyOptional({ type: 'object', additionalProperties: true, example: { modelo: 'PL-100' }, description: 'Metadados livres do sensor.' })
  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;

  // Cada licitação tem os seus tipos. Obrigatória para a Tecsus; o admin da
  // licitação pode omitir (vale a dele).
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Licitação do sensor. Obrigatória para a Tecsus; o admin da licitação pode omitir (vale a dele).',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;
}
