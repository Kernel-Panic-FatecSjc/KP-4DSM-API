import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional } from 'class-validator';
import { EhMapaDeLeituras } from './mapa-leituras.validator';
import { EhUnixtimePlausivel } from './unixtime-plausivel.validator';

/**
 * Corpo da telemetria (docs/mqtt-topico-payload.md). A ingestão confere só o
 * formato, para conseguir montar a linha de leituras_brutas; faixa física,
 * sensor configurado e estação inativa são do tratamento.
 */
export class TelemetriaDto {
  @IsOptional()
  @Type(() => Number)
  @EhUnixtimePlausivel()
  unixtime?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @EhMapaDeLeituras()
  leituras: Record<string, number>;
}
