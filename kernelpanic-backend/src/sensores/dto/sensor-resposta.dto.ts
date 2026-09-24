import type { TipoParametro } from '../../generated/prisma/client';

export class SensorRespostaDto {
  id: string;
  nome: string;
  unidade: string;
  fator: number;
  ganho: number;
  estacoesAssociadas?: number;

  constructor(sensor: TipoParametro & { _count?: { parametros: number } }) {
    this.id = sensor.id;
    this.nome = sensor.nome;
    this.unidade = sensor.unidade;
    this.fator = sensor.fator;
    this.ganho = sensor.ganho;
    this.estacoesAssociadas = sensor._count?.parametros;
  }
}
