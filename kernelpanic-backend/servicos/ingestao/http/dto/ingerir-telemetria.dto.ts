import { ApiProperty } from '@nestjs/swagger';
import { IsString, Length } from 'class-validator';
import { TelemetriaDto } from '../../validacao/telemetria.dto';

/** Na rota HTTP o vid vem no corpo; no MQTT ele vem do tópico. */
export class IngerirTelemetriaDto extends TelemetriaDto {
  @ApiProperty({ example: 'A4:CF:12:9B:77:01', minLength: 1, maxLength: 64, description: 'Identificador (vid) da estação que está enviando. Precisa ser o da chave do header `x-chave-estacao`.' })
  @IsString()
  @Length(1, 64)
  vid: string;
}
