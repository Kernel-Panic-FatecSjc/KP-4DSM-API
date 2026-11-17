import { ApiProperty } from '@nestjs/swagger';
import { SeveridadeAlerta, StatusAlarme } from '../../generated/prisma/client';

export class OpcaoFiltro {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id!: string;

  @ApiProperty({ example: 'Estação Centro' })
  nome!: string;
}

export class OpcoesFiltroRespostaDto {
  @ApiProperty({ type: [OpcaoFiltro], description: 'Estações que o chamador pode filtrar.' })
  estacoes: OpcaoFiltro[];
  @ApiProperty({ type: [OpcaoFiltro], description: 'Tipos de parâmetro (sensores) disponíveis.' })
  tiposParametro: OpcaoFiltro[];
  @ApiProperty({ enum: SeveridadeAlerta, isArray: true, description: 'Severidades aceitas.' })
  severidades: SeveridadeAlerta[] = Object.values(SeveridadeAlerta);
  @ApiProperty({ enum: StatusAlarme, isArray: true, description: 'Status aceitos.' })
  status: StatusAlarme[] = Object.values(StatusAlarme);

  constructor(estacoes: OpcaoFiltro[], tiposParametro: OpcaoFiltro[]) {
    this.estacoes = estacoes;
    this.tiposParametro = tiposParametro;
  }
}
