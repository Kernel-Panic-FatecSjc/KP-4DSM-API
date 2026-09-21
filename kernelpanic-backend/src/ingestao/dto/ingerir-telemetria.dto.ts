import { Type } from 'class-transformer';
import { IsLatitude, IsLongitude, IsOptional, IsString, Length } from 'class-validator';
import { EhMapaDeLeituras } from '../mapa-leituras.validator';
import { EhUnixtimePlausivel } from '../unixtime-plausivel.validator';

export class IngerirTelemetriaDto {
  @IsString()
  @Length(1, 64)
  vid: string;

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
