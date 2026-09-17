import { SeveridadeAlerta } from '../../generated/prisma/client';

export class OpcoesFiltroAlertasRespostaDto {
  estacoes: { id: string; nome: string }[];
  tiposParametro: { id: string; nome: string }[];
  severidades: SeveridadeAlerta[] = Object.values(SeveridadeAlerta);

  constructor(estacoes: { id: string; nome: string }[], tiposParametro: { id: string; nome: string }[]) {
    this.estacoes = estacoes;
    this.tiposParametro = tiposParametro;
  }
}
