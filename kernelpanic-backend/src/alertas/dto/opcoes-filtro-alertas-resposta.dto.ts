import { SeveridadeAlerta } from '../../generated/prisma/client';

export class OpcoesFiltroAlertasRespostaDto {
  estacoes: { id: string; nome: string }[];
  tiposParametro: { id: string; nome: string }[];
  parametros: { id: string; nome: string; unidade: string; estacaoId: string; estacaoNome: string }[];
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
