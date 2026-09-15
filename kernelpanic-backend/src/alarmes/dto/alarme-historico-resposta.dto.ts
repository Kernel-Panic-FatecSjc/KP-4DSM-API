import type {
  Alarme,
  Alerta,
  Estacao,
  Medida,
  Parametro,
  TipoParametro,
} from '../../generated/prisma/client';

type AlarmeComRelacoes = Alarme & {
  medida: Medida;
  alerta: Alerta & {
    parametro: Parametro & {
      estacao: Estacao;
      tipoParametro: TipoParametro;
    };
  };
};

export class AlarmeHistoricoRespostaDto {
  id: string;
  disparadoEm: Date;
  status: string;
  severidade: string;
  operador: string;
  valorLimite: number;
  valorMedido: number;
  estacao: { id: string; nome: string };
  parametro: { id: string; nome: string; unidade: string };

  constructor(alarme: AlarmeComRelacoes) {
    this.id = alarme.id;
    this.disparadoEm = alarme.disparadoEm;
    this.status = alarme.status;
    this.severidade = alarme.alerta.severidade;
    this.operador = alarme.alerta.operador;
    this.valorLimite = alarme.alerta.valorLimite;
    this.valorMedido = alarme.medida.valor;
    this.estacao = { id: alarme.alerta.parametro.estacao.id, nome: alarme.alerta.parametro.estacao.nome };
    this.parametro = {
      id: alarme.alerta.parametro.tipoParametro.id,
      nome: alarme.alerta.parametro.tipoParametro.nome,
      unidade: alarme.alerta.parametro.tipoParametro.unidade,
    };
  }
}
