import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsArray, IsEnum, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';
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

  @ApiPropertyOptional({ description: 'ID do contrato; envie null para desvincular a estação', format: 'uuid', nullable: true })
  @IsOptional()
  @IsUUID('4')
  contratoId?: string | null;

  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tipoParametroIds?: string[];
}
