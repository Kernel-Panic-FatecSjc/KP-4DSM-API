import { IsArray, IsDateString, IsNotEmpty, IsString, ArrayMinSize } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ConsultarEstatisticasDto {
  @ApiProperty({ type: [String], minItems: 2, description: 'IDs das estações; repita o parâmetro para cada estação.' })
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  estacaoIds: string[];

  @ApiProperty({ description: 'ID do parâmetro medido.' })
  @IsString()
  @IsNotEmpty()
  parametroId: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z' })
  @IsDateString()
  dataInicio: string;

  @ApiProperty({ format: 'date-time', example: '2026-01-31T23:59:59.000Z' })
  @IsDateString()
  dataFim: string;
}
