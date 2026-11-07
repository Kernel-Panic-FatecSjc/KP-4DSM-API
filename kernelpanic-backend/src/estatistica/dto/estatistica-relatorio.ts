import { EstatisticaEstacaoDto } from './estatitisca-estacao';
import { ApiProperty } from '@nestjs/swagger';

export class PeriodoEstatisticoDto {
  @ApiProperty()
  inicio: Date;
  @ApiProperty()
  fim: Date;
  @ApiProperty({ type: [EstatisticaEstacaoDto] })
  estacoes: EstatisticaEstacaoDto[];
}

export class DiferencaMetricaDto {
  @ApiProperty({ nullable: true, description: 'Valor do período comparado menos o valor de referência.' })
  diferencaAbsoluta: number | null;
  @ApiProperty({ nullable: true, description: 'Diferença absoluta dividida pelo valor de referência, em percentual; null quando a referência é zero ou ausente.' })
  diferencaPercentual: number | null;
}

export class ComparacaoEstacaoDto {
  @ApiProperty()
  estacaoId: string;
  @ApiProperty()
  periodoReferenciaIndice: number;
  @ApiProperty()
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

export class RelatorioEstatisticoDto {
  @ApiProperty({ type: [PeriodoEstatisticoDto] })
  periodos: PeriodoEstatisticoDto[];
  @ApiProperty({ description: 'Variância e desvio padrão populacionais (VAR_POP e STDDEV_POP).' })
  metodoCalculo: string;
  @ApiProperty({ type: [ComparacaoEstacaoDto], description: 'Cada período posterior é comparado ao primeiro período informado.' })
  comparacoes: ComparacaoEstacaoDto[];
}
