import { ApiProperty } from '@nestjs/swagger';
import { PaginacaoAbertaDto } from './medidas-abertas-resposta.dto';

export class AlarmeAbertoDto {
  @ApiProperty({ example: '9d6d2d7e-1c3a-4e8e-8f10-2b8a4a0c7e55' })
  id!: string;

  @ApiProperty({ example: '2026-11-08T14:32:10.000Z', description: 'Momento do disparo (ISO 8601, UTC).' })
  disparadoEm!: string;

  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  estacaoId!: string;

  @ApiProperty({ example: 'Estação Centro' })
  estacaoNome!: string;

  @ApiProperty({ example: 'Temperatura' })
  parametro!: string;

  @ApiProperty({
    enum: ['MAIOR_QUE', 'MENOR_QUE', 'IGUAL_A', 'DIFERENTE_DE', 'MAIOR_OU_IGUAL', 'MENOR_OU_IGUAL'],
    example: 'MAIOR_QUE',
    description: 'Condição do alerta.',
  })
  operador!: string;

  @ApiProperty({ example: 35, description: 'Limite configurado no alerta, na unidade do parâmetro.' })
  valorLimite!: number;

  @ApiProperty({ example: 38.4, description: 'Valor medido que disparou o alarme, na unidade do parâmetro.' })
  valorMedido!: number;

  @ApiProperty({ enum: ['ATENCAO', 'ALERTA', 'EMERGENCIA'], example: 'ALERTA' })
  severidade!: string;

  @ApiProperty({ enum: ['ABERTO', 'RECONHECIDO', 'RESOLVIDO'], example: 'ABERTO' })
  status!: string;
}

export class AlarmesAbertosRespostaDto {
  @ApiProperty({ type: [AlarmeAbertoDto] })
  dados!: AlarmeAbertoDto[];

  @ApiProperty({ type: PaginacaoAbertaDto })
  paginacao!: PaginacaoAbertaDto;
}
