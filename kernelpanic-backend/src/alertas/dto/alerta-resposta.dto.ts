import type { Alerta, Estacao, Parametro, TipoParametro } from '../../generated/prisma/client';

type AlertaComRelacoes = Alerta & {
  parametro: Parametro & {
    estacao: Estacao;
    tipoParametro: TipoParametro;
  };
};

export class AlertaRespostaDto {
  id: string;
  operador: string;
  valorLimite: number;
  severidade: string;
  ativo: boolean;
  criadoEm: Date;
  estacao: { id: string; nome: string };
  parametro: { id: string; nome: string; unidade: string };

  constructor(alerta: AlertaComRelacoes) {
    this.id = alerta.id;
    this.operador = alerta.operador;
    this.valorLimite = alerta.valorLimite;
    this.severidade = alerta.severidade;
    this.ativo = alerta.ativo;
    this.criadoEm = alerta.criadoEm;
    this.estacao = { id: alerta.parametro.estacao.id, nome: alerta.parametro.estacao.nome };
    this.parametro = {
      id: alerta.parametro.tipoParametro.id,
      nome: alerta.parametro.tipoParametro.nome,
      unidade: alerta.parametro.tipoParametro.unidade,
    };
  }
}
