import { ApiProperty } from '@nestjs/swagger';
import { SeveridadeAlerta } from '../../generated/prisma/client';

export class OpcaoFiltroAlertaDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id!: string;

  @ApiProperty({ example: 'Estação Centro' })
  nome!: string;
}

export class ParametroFiltroAlertaDto {
  @ApiProperty({ example: '22222222-2222-4222-8222-222222222222', description: 'Id do parâmetro (sensor da estação).' })
  id!: string;

  @ApiProperty({ example: 'Temperatura' })
  nome!: string;

  @ApiProperty({ example: '°C' })
  unidade!: string;

  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  estacaoId!: string;

  @ApiProperty({ example: 'Estação Centro' })
  estacaoNome!: string;
}

export class OpcoesFiltroAlertasRespostaDto {
  @ApiProperty({ type: [OpcaoFiltroAlertaDto], description: 'Estações que o chamador pode filtrar.' })
  estacoes: { id: string; nome: string }[];
  @ApiProperty({ type: [OpcaoFiltroAlertaDto], description: 'Tipos de parâmetro (sensores) disponíveis.' })
  tiposParametro: { id: string; nome: string }[];
  @ApiProperty({ type: [ParametroFiltroAlertaDto], description: 'Parâmetros (sensor de cada estação) disponíveis.' })
  parametros: { id: string; nome: string; unidade: string; estacaoId: string; estacaoNome: string }[];
  @ApiProperty({ enum: SeveridadeAlerta, isArray: true, description: 'Severidades aceitas.' })
  severidades: SeveridadeAlerta[] = Object.values(SeveridadeAlerta);

  constructor(
    estacoes: { id: string; nome: string }[],
    tiposParametro: { id: string; nome: string }[],
    parametros: { id: string; nome: string; unidade: string; estacaoId: string; estacaoNome: string }[],
  ) {
    this.estacoes = estacoes;
    this.tiposParametro = tiposParametro;
    this.parametros = parametros;
  }
}
