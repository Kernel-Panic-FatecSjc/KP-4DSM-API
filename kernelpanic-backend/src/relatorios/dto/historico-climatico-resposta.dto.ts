import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EstatisticasHistoricoDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    example: '2026-11-08T14:00:00.000Z',
    description: 'Início do intervalo agregado; omitido no total do período.',
  })
  periodo?: string;

  @ApiProperty({
    enum: ['SOMA', 'MEDIA'],
    description: 'Regra cadastrada para o tipo de parâmetro.',
  })
  agregacao: 'SOMA' | 'MEDIA';

  @ApiProperty({
    example: 24.6,
    description: 'Valor consolidado conforme a agregação configurada.',
  })
  valor: number;

  @ApiProperty({ example: 295.2, description: 'Soma das leituras no intervalo.' })
  soma: number;

  @ApiProperty({ example: 24.6, description: 'Média das leituras no intervalo.' })
  media: number;

  @ApiProperty({ example: 21.3, description: 'Menor leitura no intervalo.' })
  minimo: number;

  @ApiProperty({ example: 28.9, description: 'Maior leitura no intervalo.' })
  maximo: number;

  @ApiProperty({ example: 12, description: 'Quantidade de leituras no intervalo.' })
  leituras: number;
}

export class ParametroHistoricoClimaticoDto {
  @ApiProperty({ format: 'uuid', example: '11111111-1111-4111-8111-111111111111', description: 'Id do tipo de parâmetro (sensor).' })
  id: string;

  @ApiProperty({ example: 'Temperatura' })
  nome: string;

  @ApiProperty({ example: '°C' })
  unidade: string;

  @ApiProperty({ enum: ['SOMA', 'MEDIA'] })
  agregacao: 'SOMA' | 'MEDIA';

  @ApiProperty({ type: [EstatisticasHistoricoDto], description: 'Estatísticas de cada hora ou dia do período.' })
  periodos: EstatisticasHistoricoDto[];

  @ApiProperty({
    type: EstatisticasHistoricoDto,
    description: 'Total consolidado em todo o intervalo solicitado.',
  })
  totalPeriodo: EstatisticasHistoricoDto;
}

export class EstacaoHistoricoClimaticoDto {
  @ApiProperty({ format: 'uuid', example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id: string;

  @ApiProperty({ example: 'Estação Centro' })
  nome: string;

  @ApiProperty({ type: [ParametroHistoricoClimaticoDto], description: 'Parâmetros da estação com o histórico consolidado.' })
  parametros: ParametroHistoricoClimaticoDto[];
}

export class HistoricoClimaticoRespostaDto {
  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-01T00:00:00.000Z', description: 'Início do período consultado (ISO 8601, UTC).' })
  de: string;

  @ApiProperty({ type: String, format: 'date-time', example: '2026-11-07T23:59:59.999Z', description: 'Fim do período consultado (ISO 8601, UTC).' })
  ate: string;

  @ApiProperty({ enum: ['hora', 'dia'] })
  granularidade: string;

  @ApiProperty({ type: [EstacaoHistoricoClimaticoDto], description: 'Estações com dados no período.' })
  estacoes: EstacaoHistoricoClimaticoDto[];
}
