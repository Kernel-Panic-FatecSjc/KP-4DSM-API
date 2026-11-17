import { ApiProperty } from '@nestjs/swagger';

export class SaudeRespostaDto {
  @ApiProperty({ enum: ['ok', 'falha'], example: 'ok', description: 'Estado da conexão com o banco de dados.' })
  banco!: 'ok' | 'falha';
}
