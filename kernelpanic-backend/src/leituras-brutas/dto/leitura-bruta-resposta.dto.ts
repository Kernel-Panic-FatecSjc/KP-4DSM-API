import { ApiProperty } from '@nestjs/swagger';

export interface LeituraBrutaResposta {
  id: string;
  vidEstacao: string;
  recebidoEm: Date;
  unixtimeDispositivo: string;
  latitude: number;
  longitude: number;
  payload: unknown;
}

export class LeituraBrutaRespostaDto implements LeituraBrutaResposta {
  @ApiProperty({ example: '3f2504e0-4f89-41d3-9a0c-0305e82c3301' })
  id: string;
  @ApiProperty({ example: 'A4:CF:12:9B:77:01', description: 'Identificador (vid) da estação que enviou.' })
  vidEstacao: string;
  @ApiProperty({ example: '2026-11-08T14:32:10.000Z', description: 'Momento em que a plataforma recebeu o pacote (ISO 8601, UTC).' })
  recebidoEm: Date;
  @ApiProperty({ example: '1792869809', description: 'Unix time (segundos) da leitura no dispositivo, como texto.' })
  unixtimeDispositivo: string;
  @ApiProperty({ example: -23.1896, description: 'Latitude enviada pelo dispositivo (WGS84).' })
  latitude: number;
  @ApiProperty({ example: -45.8841, description: 'Longitude enviada pelo dispositivo (WGS84).' })
  longitude: number;
  @ApiProperty({
    type: 'object',
    additionalProperties: true,
    example: { temperatura: 24.6, chuva: 1.2 },
    description: 'Leituras exatamente como chegaram do dispositivo (nome do sensor e valor bruto).',
  })
  payload: unknown;

  constructor(leitura: LeituraBrutaResposta) {
    this.id = leitura.id;
    this.vidEstacao = leitura.vidEstacao;
    this.recebidoEm = leitura.recebidoEm;
    this.unixtimeDispositivo = leitura.unixtimeDispositivo;
    this.latitude = leitura.latitude;
    this.longitude = leitura.longitude;
    this.payload = leitura.payload;
  }
}
