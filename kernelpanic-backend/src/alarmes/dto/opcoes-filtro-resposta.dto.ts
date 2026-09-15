import { SeveridadeAlerta, StatusAlarme } from '../../generated/prisma/client';

export class OpcoesFiltroRespostaDto {
  estacoes: { id: string; nome: string }[];
  tiposParametro: { id: string; nome: string }[];
  severidades: SeveridadeAlerta[] = Object.values(SeveridadeAlerta);
  status: StatusAlarme[] = Object.values(StatusAlarme);

  constructor(estacoes: { id: string; nome: string }[], tiposParametro: { id: string; nome: string }[]) {
    this.estacoes = estacoes;
    this.tiposParametro = tiposParametro;
  }
}
