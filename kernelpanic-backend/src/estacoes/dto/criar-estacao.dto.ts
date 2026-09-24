import { IsArray, IsLatitude, IsLongitude, IsNotEmpty, IsOptional, IsString, IsUUID, Matches } from 'class-validator';

export const IDENTIFICADOR_UUID_OU_MAC = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2})$/i;

export class CriarEstacaoDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsString()
  @IsNotEmpty()
  endereco!: string;

  @IsString()
  @Matches(IDENTIFICADOR_UUID_OU_MAC, { message: 'vid deve ser um UUID ou MAC válido' })
  vid!: string;

  @IsLatitude()
  latitude!: number;

  @IsLongitude()
  longitude!: number;

  // Opcional: a estação pode ser cadastrada antes de os sensores existirem e
  // recebê-los depois por PATCH.
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tipoParametroIds?: string[];
}