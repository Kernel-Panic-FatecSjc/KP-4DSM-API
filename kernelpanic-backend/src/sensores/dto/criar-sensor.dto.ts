import { IsNotEmpty, IsNumber, IsObject, IsOptional, IsString, MaxLength } from 'class-validator';

export class CriarSensorDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(120)
  nome!: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(20)
  unidade!: string;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  fator!: number;

  @IsNumber({ allowInfinity: false, allowNaN: false })
  ganho!: number;

  @IsOptional()
  @IsObject()
  json?: Record<string, unknown>;
}
