import { Transform } from 'class-transformer';
import { IsEnum, IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength, NotEquals } from 'class-validator';
import { UnidadeSensor } from '../unidade-sensor';
import { aparar, MENSAGEM_UNIDADE } from './criar-sensor.dto';

export class AtualizarSensorDto {
  @IsOptional()
  @Transform(aparar)
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsEnum(UnidadeSensor, { message: MENSAGEM_UNIDADE })
  unidade?: UnidadeSensor;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  @NotEquals(0, { message: 'fator não pode ser zero' })
  fator?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  ganho?: number;

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
}
