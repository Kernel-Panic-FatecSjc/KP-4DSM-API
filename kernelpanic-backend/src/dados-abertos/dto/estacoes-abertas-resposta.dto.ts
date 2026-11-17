import { ApiProperty } from '@nestjs/swagger';
import { PaginacaoAbertaDto } from './medidas-abertas-resposta.dto';

export class SensorAbertoDto {
  @ApiProperty({ example: 'Temperatura' })
  nome!: string;

  @ApiProperty({ example: '°C' })
  unidade!: string;
}

export class EstacaoAbertaDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id!: string;

  @ApiProperty({ example: 'Estação Centro' })
  nome!: string;

  @ApiProperty({ example: -23.1896, description: 'Graus decimais (WGS84, EPSG:4326).' })
  latitude!: number;

  @ApiProperty({ example: -45.8841, description: 'Graus decimais (WGS84, EPSG:4326).' })
  longitude!: number;

  @ApiProperty({ enum: ['ATIVA', 'INATIVA'], example: 'ATIVA' })
  statusOperacional!: string;

  @ApiProperty({ type: [SensorAbertoDto], description: 'Parâmetros medidos pela estação.' })
  sensores!: SensorAbertoDto[];
}

export class EstacoesAbertasRespostaDto {
  @ApiProperty({ type: [EstacaoAbertaDto], description: 'Estações da página.' })
  dados!: EstacaoAbertaDto[];

  @ApiProperty({ type: PaginacaoAbertaDto })
  paginacao!: PaginacaoAbertaDto;
}
