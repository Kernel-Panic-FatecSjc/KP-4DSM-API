import type { Prisma } from '../../generated/prisma/client';

type EstacaoComSensores = Prisma.EstacaoGetPayload<{
  include: { parametros: { include: { tipoParametro: true } } };
}>;

export class EstacaoRespostaDto {
  id: string;
  nome: string;
  endereco: string;
  vid: string;
  latitude: number;
  longitude: number;
  statusOperacional: string;
  sensores: Array<{ id: string; nome: string; unidade: string }>;
  criadoEm: Date;
  atualizadoEm: Date;

  constructor(estacao: EstacaoComSensores) {
    this.id = estacao.id;
    this.nome = estacao.nome;
    this.endereco = estacao.endereco;
    this.vid = estacao.vid;
    this.latitude = estacao.latitude;
    this.longitude = estacao.longitude;
    this.statusOperacional = estacao.statusOperacional;
    this.sensores = estacao.parametros.map(({ tipoParametro }) => ({
      id: tipoParametro.id,
      nome: tipoParametro.nome,
      unidade: tipoParametro.unidade,
    }));
    this.criadoEm = estacao.criadoEm;
    this.atualizadoEm = estacao.atualizadoEm;
  }
}