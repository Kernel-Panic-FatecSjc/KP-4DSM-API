export interface ParametroConfigurado {
  tipoParametroId: string;
  nome: string;
  unidade: string;
  fator: number;
  ganho: number;
}

export class EstacaoParametrosRespostaDto {
  constructor(
    public estacaoId: string,
    public vid: string,
    public nome: string,
    public parametros: ParametroConfigurado[],
  ) {}
}
