import { ApiProperty } from '@nestjs/swagger';

export class SaudeIngestaoRespostaDto {
  @ApiProperty({ enum: ['ok', 'falha'], example: 'ok', description: 'Conexão com o banco de dados.' })
  banco!: 'ok' | 'falha';

  @ApiProperty({ enum: ['ok', 'falha'], example: 'ok', description: 'Se o lote de leituras em memória está sendo gravado (falha = há leituras que não conseguiram ser gravadas).' })
  lote!: 'ok' | 'falha';

  @ApiProperty({ enum: ['ok', 'falha', 'desligado'], example: 'ok', description: 'Conexão com o broker MQTT.' })
  mqtt!: 'ok' | 'falha' | 'desligado';

  @ApiProperty({ example: 0, description: 'Mensagens MQTT recusadas desde que o serviço subiu.' })
  mensagensRecusadas!: number;
}
