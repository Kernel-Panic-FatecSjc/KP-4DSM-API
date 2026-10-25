import { IsString, Length } from 'class-validator';
import { TelemetriaDto } from '../../validacao/telemetria.dto';

/** Na rota HTTP o vid vem no corpo; no MQTT ele vem do tópico. */
export class IngerirTelemetriaDto extends TelemetriaDto {
  @IsString()
  @Length(1, 64)
  vid: string;
}
