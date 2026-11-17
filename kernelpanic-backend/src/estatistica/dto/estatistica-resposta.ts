import { ApiProperty } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { ArrayMaxSize, ArrayMinSize, IsArray, IsNotEmpty, IsString } from 'class-validator';

export class ConsultarEstatisticasDto {
  @ApiProperty({ type: [String], minItems: 1, description: 'IDs das estações; repita o parâmetro para cada estação.' })
  @Transform(({ value }) => Array.isArray(value) ? value : [value])
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(200)
  @IsString({ each: true })
  estacaoIds: string[];

  @ApiProperty({ example: '7c1d2e3f-4a5b-4c6d-8e9f-0a1b2c3d4e5f', description: 'ID do parâmetro medido.' })
  @IsString()
  @IsNotEmpty()
  parametroId: string;

  @ApiProperty({
    type: [String],
    minItems: 2,
    description: 'Repita para cada intervalo, no formato ISO_INICIO|ISO_FIM. A ordem define a referência (primeiro período). Ex.: 2026-01-01T00:00:00.000Z|2026-01-31T23:59:59.999Z',
  })
  @IsArray()
  @ArrayMinSize(2)
  @ArrayMaxSize(12)
  @IsString({ each: true })
  periodos: string[];
}
