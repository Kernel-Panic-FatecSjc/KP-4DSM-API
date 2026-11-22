import { ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsArray,
  IsEnum,
  IsLatitude,
  IsLongitude,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUUID,
  Matches,
} from 'class-validator';
import { StatusOperacionalEstacao } from '../../generated/prisma/client';
import { IDENTIFICADOR_UUID_OU_MAC } from './criar-estacao.dto';

export class AtualizarEstacaoDto {
  @ApiPropertyOptional({ example: 'Estação Centro', description: 'Novo nome.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  nome?: string;

  @ApiPropertyOptional({ example: 'Praça Afonso Pena, 100 - Centro', description: 'Novo endereço.' })
  @IsOptional()
  @IsString()
  @IsNotEmpty()
  endereco?: string;

  @ApiPropertyOptional({ example: 'A4:CF:12:9B:77:01', description: 'Novo identificador do dispositivo (MAC ou UUID). Único no sistema.' })
  @IsOptional()
  @IsString()
  @Matches(IDENTIFICADOR_UUID_OU_MAC, {
    message: 'vid deve ser um UUID ou MAC válido',
  })
  vid?: string;

  @ApiPropertyOptional({ example: -23.1896, description: 'Nova latitude em graus decimais (WGS84).' })
  @IsOptional()
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -45.8841, description: 'Nova longitude em graus decimais (WGS84).' })
  @IsOptional()
  @IsLongitude()
  longitude?: number;

  @ApiPropertyOptional({ enum: StatusOperacionalEstacao, description: 'Novo status operacional.' })
  @IsOptional()
  @IsEnum(StatusOperacionalEstacao)
  statusOperacional?: StatusOperacionalEstacao;

  @ApiPropertyOptional({
    type: [String],
    example: ['11111111-1111-4111-8111-111111111111'],
    description: 'Lista completa de sensores da estação. Sensor que já tem medidas não pode ser removido.',
  })
  @IsOptional()
  @IsArray()
  @IsUUID('4', { each: true })
  tipoParametroIds?: string[];
}
