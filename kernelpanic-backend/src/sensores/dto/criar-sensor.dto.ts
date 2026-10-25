import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, IsUUID, MaxLength, NotEquals } from 'class-validator';
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

  // Faixa física válida da leitura, inclusiva e opcional: fora dela a ingestão
  // não grava a medida (ver leituras_erro). null limpa o limite.
  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  valorMinimo?: number | null;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  valorMaximo?: number | null;

  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;

  // Cada licitação tem os seus tipos. Obrigatória para a Tecsus; o admin da
  // licitação pode omitir (vale a dele).
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;
}
