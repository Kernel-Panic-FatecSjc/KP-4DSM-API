import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';

export const IDENTIFICADOR_UUID_OU_MAC =
  /^(?:[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}|(?:[0-9a-f]{2}[:-]){5}[0-9a-f]{2})$/i;

export class CriarEstacaoDto {
  @ApiProperty({ example: 'Estação Centro', description: 'Nome da estação.' })
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @ApiProperty({ example: 'Praça Afonso Pena, 100 - Centro', description: 'Endereço de instalação.' })
  @IsString()
  @IsNotEmpty()
  endereco!: string;

  @ApiProperty({ example: 'A4:CF:12:9B:77:01', description: 'Identificador do dispositivo (MAC ou UUID). Único no sistema.' })
  @IsString()
  @Matches(IDENTIFICADOR_UUID_OU_MAC, {
    message: 'vid deve ser um UUID ou MAC válido',
  })
  vid!: string;

  @ApiProperty({ example: -23.1896, description: 'Latitude em graus decimais (WGS84).' })
  @IsLatitude()
  latitude!: number;

  @ApiProperty({ example: -45.8841, description: 'Longitude em graus decimais (WGS84).' })
  @IsLongitude()
  longitude!: number;

  // Obrigatória para a Tecsus; o admin da licitação pode omitir (vale a dele).
  // Não existe estação sem licitação.
  @ApiPropertyOptional({
    example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10',
    description: 'Licitação da estação. Obrigatória para a Tecsus; o admin da licitação pode omitir (vale a dele).',
  })
  @IsOptional()
  @IsUUID('4')
  licitacaoId?: string;

  // Opcional: a estação pode ser cadastrada antes de os sensores existirem e
  // recebê-los depois por PATCH. Os sensores são da licitação da estação.
  @ApiPropertyOptional({
    type: [String],
    example: ['11111111-1111-4111-8111-111111111111'],
    description: 'Sensores (tipos de parâmetro) da estação, da mesma licitação. Podem ser informados depois, por PATCH.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tipoParametroIds?: string[];
}
