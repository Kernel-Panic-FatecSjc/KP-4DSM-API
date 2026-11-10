import { ApiProperty } from '@nestjs/swagger';

export class SaudeTratamentoRespostaDto {
  @ApiProperty({ example: true, description: 'Se o último ciclo de tratamento terminou sem erro.' })
  ultimoCicloOk!: boolean;

  @ApiProperty({ example: '2026-11-08T14:32:10.000Z', nullable: true, description: 'Fim do último ciclo (ISO 8601, UTC); null antes do primeiro.' })
  ultimoCicloEm!: Date | null;

  @ApiProperty({ example: 1520, description: 'Leituras brutas tratadas desde que o serviço subiu.' })
  processadasDesdeInicio!: number;

  @ApiProperty({ example: true, description: 'Se o serviço está escutando as notificações do banco.' })
  escutandoBanco!: boolean;

  @ApiProperty({ enum: ['ok', 'falha'], example: 'ok', description: 'Conexão com o banco de dados.' })
  banco!: string;

  @ApiProperty({ example: 0, description: 'Leituras brutas que ainda esperam o tratamento (o atraso da cadeia).' })
  pendentes!: number;
}
