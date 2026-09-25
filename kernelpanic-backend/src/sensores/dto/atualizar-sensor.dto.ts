import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class AtualizarSensorDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidade?: string;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  fator?: number;

  @IsOptional()
  @IsNumber({ allowInfinity: false, allowNaN: false })
  ganho?: number;

  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;
}
