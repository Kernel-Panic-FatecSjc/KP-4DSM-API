import { ApiProperty } from '@nestjs/swagger';

export class EstatisticaEstacaoDto {
  @ApiProperty()
  estacaoId: string;
  @ApiProperty()
  estacaoNome: string;

  @ApiProperty({ description: 'Número de leituras no período.' })
  quantidade: number;
  @ApiProperty({ nullable: true })
  media: number | null;
  @ApiProperty({ nullable: true })
  mediana: number | null;

  @ApiProperty({ nullable: true, description: 'Desvio padrão populacional (STDDEV_POP).' })
  desvioPadrao: number | null;
  @ApiProperty({ nullable: true, description: 'Variância populacional (VAR_POP).' })
  variancia: number | null;

  @ApiProperty({ nullable: true })
  quartil1: number | null;
  @ApiProperty({ nullable: true })
  quartil2: number | null;
  @ApiProperty({ nullable: true })
  quartil3: number | null;

  @ApiProperty({ nullable: true })
  minimo: number | null;
  @ApiProperty({ nullable: true })
  maximo: number | null;
}
