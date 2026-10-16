import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../../generated/prisma/client';

type EstacaoComSensores = Prisma.EstacaoGetPayload<{
  include: { parametros: { include: { tipoParametro: true } } };
}>;

export class EstacaoRespostaDto {
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  id: string;
  @ApiProperty({ example: 'Estação Norte' })
  nome: string;
  endereco: string;
  vid: string;
  latitude: number;
  longitude: number;
  statusOperacional: string;
  @ApiProperty({ type: String, nullable: true, description: 'ID do contrato vinculado à estação' })
  contratoId: string | null;
  @ApiProperty({
    description: 'Tipos de sensores/parâmetros configurados na estação, com unidade de medida',
    type: 'array',
    items: { type: 'object', properties: {
      id: { type: 'string' }, nome: { type: 'string' }, unidade: { type: 'string' },
    } },
  })
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
    this.contratoId = estacao.contratoId;
    this.sensores = estacao.parametros.map(({ tipoParametro }) => ({
      id: tipoParametro.id,
      nome: tipoParametro.nome,
      unidade: tipoParametro.unidade,
    }));
    this.criadoEm = estacao.criadoEm;
    this.atualizadoEm = estacao.atualizadoEm;
  }
}