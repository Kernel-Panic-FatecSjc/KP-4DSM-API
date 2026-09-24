import { IsArray, IsLatitude, IsLongitude, IsNotEmpty, IsString, IsUUID, Matches } from 'class-validator';

const IDENTIFICADOR_UUID_OU_MAC = /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2})$/i;

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

  @IsArray()
  @IsUUID('4', { each: true })
  tipoParametroIds!: string[];
}