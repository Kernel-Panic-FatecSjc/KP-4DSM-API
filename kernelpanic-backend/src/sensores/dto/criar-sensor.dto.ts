import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';
import { UnidadeSensor } from '../unidade-sensor';

// Sem isso, um nome só com espaços passaria pelo @IsNotEmpty e "Pluviômetro "
// escaparia da checagem de nome repetido.
export function aparar({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export const MENSAGEM_UNIDADE = `unidade deve ser uma de: ${Object.values(UnidadeSensor).join(', ')}`;

export class CriarSensorDto {
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsEnum(UnidadeSensor, { message: MENSAGEM_UNIDADE })
  unidade!: UnidadeSensor;

  // O fator multiplica a leitura bruta: zero apagaria toda medição do sensor.
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @NotEquals(0, { message: 'fator não pode ser zero' })
  fator!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  ganho!: number;

  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;
}
