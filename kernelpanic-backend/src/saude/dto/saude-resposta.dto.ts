import { ApiProperty } from '@nestjs/swagger';

export class SaudeRespostaDto {
  @ApiProperty({ enum: ['ok', 'falha'], example: 'ok', description: 'Estado da conexão com o banco de dados.' })
  banco!: 'ok' | 'falha';

  @ApiProperty({ example: 'a6e8372', description: 'Commit (7 caracteres) do pacote instalado no ambiente; "desenvolvimento" fora de um pacote de deploy.' })
  versao!: string;
}
