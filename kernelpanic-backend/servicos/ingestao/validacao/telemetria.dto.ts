import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
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
  @ApiPropertyOptional({
    example: 1792869809,
    description: 'Unix time, em segundos, do momento da leitura no dispositivo (entre 1.000.000.000 e agora + 5 min). Sem ele vale o momento do recebimento.',
  })
  @IsOptional()
  @Type(() => Number)
  @EhUnixtimePlausivel()
  unixtime?: number;

  @ApiPropertyOptional({ example: -23.1896, description: 'Latitude do dispositivo em graus decimais (WGS84).' })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  latitude?: number;

  @ApiPropertyOptional({ example: -45.8841, description: 'Longitude do dispositivo em graus decimais (WGS84).' })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  longitude?: number;

  @ApiProperty({
    type: 'object',
    additionalProperties: { type: 'number' },
    example: { temperatura: 24.6, chuva: 1.2 },
    description: 'Leituras brutas por sensor: o nome do sensor (como cadastrado na estação) e o valor numérico enviado pelo dispositivo.',
  })
  @EhMapaDeLeituras()
  leituras: Record<string, number>;
}
