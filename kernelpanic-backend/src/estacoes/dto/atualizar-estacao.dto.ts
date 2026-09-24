import { ArrayNotEmpty, IsArray, IsEnum, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
import { StatusOperacionalEstacao } from '../../generated/prisma/client';
import { IDENTIFICADOR_UUID_OU_MAC } from './criar-estacao.dto';

export class AtualizarEstacaoDto {
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @IsOptional()
  @IsString()
  @IsNotEmpty()
  endereco?: string;

  @IsOptional()
  @IsString()
  @Matches(IDENTIFICADOR_UUID_OU_MAC, { message: 'vid deve ser um UUID ou MAC válido' })
  vid?: string;

  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @IsOptional()
  @IsEnum(StatusOperacionalEstacao)
  statusOperacional?: StatusOperacionalEstacao;

  @IsOptional()
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  tipoParametroIds?: string[];
}
