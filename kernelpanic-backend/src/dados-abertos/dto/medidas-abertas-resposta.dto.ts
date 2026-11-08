import { ApiProperty } from '@nestjs/swagger';

export class MedidaAbertaDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  estacaoId!: string;

  @ApiProperty({ example: 'Estação Centro' })
  estacaoNome!: string;

  @ApiProperty({ example: 'Temperatura' })
  parametro!: string;

  @ApiProperty({ example: '°C', description: 'Unidade do parâmetro.' })
  unidade!: string;

  @ApiProperty({ example: '2026-11-08T14:00:00.000Z', description: 'Início da hora ou do dia agregado (ISO 8601, UTC).' })
  inicio!: string;

  @ApiProperty({ enum: ['hora', 'dia'], example: 'hora' })
  granularidade!: string;

  @ApiProperty({ enum: ['SOMA', 'MEDIA'], example: 'MEDIA', description: 'Regra usada no intervalo (SOMA para precipitação).' })
  agregacao!: string;

  @ApiProperty({ example: 24.6, description: 'Valor agregado, na unidade do parâmetro.' })
  valor!: number;

  @ApiProperty({ example: 12, description: 'Quantidade de leituras que compõem o valor.' })
  quantidadeLeituras!: number;
}

export class PaginacaoAbertaDto {
  @ApiProperty({ example: 1 })
  pagina!: number;

  @ApiProperty({ example: 100 })
  tamanhoPagina!: number;

  @ApiProperty({ example: 240, description: 'Total de linhas do filtro, somando todas as páginas.' })
  total!: number;
}

export class MedidasAbertasRespostaDto {
  @ApiProperty({ type: [MedidaAbertaDto] })
  dados!: MedidaAbertaDto[];

  @ApiProperty({ type: PaginacaoAbertaDto })
  paginacao!: PaginacaoAbertaDto;
}
