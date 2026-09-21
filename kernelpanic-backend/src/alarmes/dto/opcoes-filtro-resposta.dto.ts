import { SeveridadeAlerta, StatusAlarme } from '../../generated/prisma/client';

export interface OpcaoFiltro {
  id: string;
  nome: string;
}

export class OpcoesFiltroRespostaDto {
  estacoes: OpcaoFiltro[];
  tiposParametro: OpcaoFiltro[];
  severidades: SeveridadeAlerta[] = Object.values(SeveridadeAlerta);
  status: StatusAlarme[] = Object.values(StatusAlarme);

  constructor(estacoes: OpcaoFiltro[], tiposParametro: OpcaoFiltro[]) {
    this.estacoes = estacoes;
    this.tiposParametro = tiposParametro;
  }
}
