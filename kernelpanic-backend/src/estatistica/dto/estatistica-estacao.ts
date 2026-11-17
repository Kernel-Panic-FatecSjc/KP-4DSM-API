import { ApiProperty } from '@nestjs/swagger';

export class EstatisticaEstacaoDto {
  @ApiProperty({ format: 'uuid', example: '3f8a2c1e-9b4d-4e7a-8c21-5d6f7a8b9c0d', description: 'Estação.' })
  estacaoId: string;
  @ApiProperty({ example: 'Estação Centro', description: 'Nome da estação.' })
  estacaoNome: string;

  @ApiProperty({ example: 288, description: 'Número de leituras no período.' })
  quantidade: number;
  @ApiProperty({ type: Number, nullable: true, example: 21.4, description: 'Média das leituras (null sem leitura).' })
  media: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 21, description: 'Mediana das leituras.' })
  mediana: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 2.3, description: 'Desvio padrão populacional (STDDEV_POP).' })
  desvioPadrao: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 5.29, description: 'Variância populacional (VAR_POP).' })
  variancia: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 19.8, description: 'Primeiro quartil (25%).' })
  quartil1: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 21, description: 'Segundo quartil (50%).' })
  quartil2: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 23.1, description: 'Terceiro quartil (75%).' })
  quartil3: number | null;

  @ApiProperty({ type: Number, nullable: true, example: 15.2, description: 'Menor leitura.' })
  minimo: number | null;
  @ApiProperty({ type: Number, nullable: true, example: 27.9, description: 'Maior leitura.' })
  maximo: number | null;
}
