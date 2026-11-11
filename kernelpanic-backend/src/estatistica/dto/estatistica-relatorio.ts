import { EstatisticaEstacaoDto } from './estatistica-estacao';
import { ApiProperty } from '@nestjs/swagger';

export class PeriodoEstatisticoDto {
  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-01T00:00:00.000Z', description: 'Início do período.' })
  inicio: Date;
  @ApiProperty({ type: String, format: 'date-time', example: '2026-01-31T23:59:59.999Z', description: 'Fim do período.' })
  fim: Date;
  @ApiProperty({ type: [EstatisticaEstacaoDto], description: 'Estatísticas de cada estação no período.' })
  estacoes: EstatisticaEstacaoDto[];
}

export class DiferencaMetricaDto {
  @ApiProperty({ type: Number, nullable: true, example: 1.2, description: 'Valor do período comparado menos o valor de referência.' })
  diferencaAbsoluta: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 5.6, description: 'Diferença absoluta dividida pelo valor de referência, em percentual; null quando a referência é zero ou ausente.' })
  diferencaPercentual: number | null;
}

export class ComparacaoEstacaoDto {
  @ApiProperty({ format: 'uuid', example: '3f8a2c1e-9b4d-4e7a-8c21-5d6f7a8b9c0d', description: 'Estação comparada.' })
  estacaoId: string;
  @ApiProperty({ example: 0, description: 'Índice (base 0) do período de referência.' })
  periodoReferenciaIndice: number;
  @ApiProperty({ example: 1, description: 'Índice (base 0) do período comparado.' })
  periodoComparadoIndice: number;
  @ApiProperty({ type: DiferencaMetricaDto })
  quantidade: DiferencaMetricaDto;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  media: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  mediana: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  desvioPadrao: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  variancia: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  quartil1: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  quartil2: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  quartil3: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  minimo: DiferencaMetricaDto | null;
  @ApiProperty({ type: DiferencaMetricaDto, nullable: true })
  maximo: DiferencaMetricaDto | null;
}

export class MicroclimaRiscoDto {
  @ApiProperty({ example: 0, description: 'Índice (base 0) do período.' })
  periodoIndice: number;
  @ApiProperty({ format: 'uuid', example: '3f8a2c1e-9b4d-4e7a-8c21-5d6f7a8b9c0d', description: 'Estação em risco.' })
  estacaoId: string;
  @ApiProperty({ example: 'Estação Centro', description: 'Nome da estação.' })
  estacaoNome: string;
  @ApiProperty({ example: 31.5, description: 'Mediana da estação no período.' })
  media: number;
  @ApiProperty({ example: 21, description: 'Média das medianas das estações do grupo.' })
  medianaGrupo: number;
  @ApiProperty({ example: 10.5, description: 'Mediana da estação menos a média das medianas do grupo.' })
  diferencaParaMediana: number;
}

export class RelatorioEstatisticoDto {
  @ApiProperty({ type: [PeriodoEstatisticoDto], description: 'Períodos na ordem informada; o primeiro é a referência.' })
  periodos: PeriodoEstatisticoDto[];
  @ApiProperty({ example: 'Variância e desvio padrão populacionais (VAR_POP e STDDEV_POP).', description: 'Variância e desvio padrão populacionais (VAR_POP e STDDEV_POP).' })
  metodoCalculo: string;
  @ApiProperty({ type: [ComparacaoEstacaoDto], description: 'Cada período posterior é comparado ao primeiro período informado.' })
  comparacoes: ComparacaoEstacaoDto[];
  @ApiProperty({ type: [MicroclimaRiscoDto], description: 'Estações cuja mediana fica a mais de 2 desvios padrão populacionais da média das medianas do grupo no período.' })
  microclimasRisco: MicroclimaRiscoDto[];
}
