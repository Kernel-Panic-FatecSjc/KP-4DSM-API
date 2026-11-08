import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class EstatisticasHistoricoDto {
  @ApiPropertyOptional({
    type: String,
    format: 'date-time',
    description: 'Início do intervalo agregado; omitido no total do período.',
  })
  periodo?: string;

  @ApiProperty({
    enum: ['SOMA', 'MEDIA'],
    description: 'Regra cadastrada para o tipo de parâmetro.',
  })
  agregacao: 'SOMA' | 'MEDIA';

  @ApiProperty({
    description: 'Valor consolidado conforme a agregação configurada.',
  })
  valor: number;

  @ApiProperty({ description: 'Soma das leituras no intervalo.' })
  soma: number;

  @ApiProperty({ description: 'Média das leituras no intervalo.' })
  media: number;

  @ApiProperty({ description: 'Menor leitura no intervalo.' })
  minimo: number;

  @ApiProperty({ description: 'Maior leitura no intervalo.' })
  maximo: number;

  @ApiProperty({ description: 'Quantidade de leituras no intervalo.' })
  leituras: number;
}

export class ParametroHistoricoClimaticoDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty()
  unidade: string;

  @ApiProperty({ enum: ['SOMA', 'MEDIA'] })
  agregacao: 'SOMA' | 'MEDIA';

  @ApiProperty({ type: [EstatisticasHistoricoDto] })
  periodos: EstatisticasHistoricoDto[];

  @ApiProperty({
    type: EstatisticasHistoricoDto,
    description: 'Total consolidado em todo o intervalo solicitado.',
  })
  totalPeriodo: EstatisticasHistoricoDto;
}

export class EstacaoHistoricoClimaticoDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  nome: string;

  @ApiProperty({ type: [ParametroHistoricoClimaticoDto] })
  parametros: ParametroHistoricoClimaticoDto[];
}

export class HistoricoClimaticoRespostaDto {
  @ApiProperty({ type: String, format: 'date-time' })
  de: string;

  @ApiProperty({ type: String, format: 'date-time' })
  ate: string;

  @ApiProperty({ enum: ['hora', 'dia'] })
  granularidade: string;

  @ApiProperty({ type: [EstacaoHistoricoClimaticoDto] })
  estacoes: EstacaoHistoricoClimaticoDto[];
}
