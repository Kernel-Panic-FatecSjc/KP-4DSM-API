import { EstatisticaEstacaoDto } from './estatitisca-estacao';
import { ApiProperty } from '@nestjs/swagger';

export class RelatorioEstatisticoDto {
  @ApiProperty()
  parametroId: string;
  @ApiProperty()
  dataInicio: Date;
  @ApiProperty()
  dataFim: Date;

  @ApiProperty({ description: 'Variância e desvio padrão calculados como população (VAR_POP e STDDEV_POP).' })
  metodoCalculo: string;

  @ApiProperty({ type: [EstatisticaEstacaoDto] })
  estacoes: EstatisticaEstacaoDto[];
}
