import type { Prisma } from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

type EstacaoComSensores = Prisma.EstacaoGetPayload<{
  include: { parametros: { include: { tipoParametro: true } } };
}>;

export class EstacaoRespostaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  nome: string;
  @ApiProperty()
  endereco: string;
  @ApiProperty()
  vid: string;
  @ApiProperty()
  latitude: number;
  @ApiProperty()
  longitude: number;
  @ApiProperty({ enum: ['ATIVA', 'INATIVA'] })
  statusOperacional: string;
  @ApiProperty({ format: 'uuid', nullable: true })
  contratoId: string | null;
  @ApiProperty()
  possuiChaveIngestao: boolean;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  sensores: Array<{ id: string; nome: string; unidade: string }>;
  @ApiProperty({ format: 'date-time' })
  criadoEm: Date;
  @ApiProperty({ format: 'date-time' })
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
    this.possuiChaveIngestao = Boolean(estacao.chaveIngestaoHash);
    this.sensores = estacao.parametros.map(({ tipoParametro }) => ({
      id: tipoParametro.id,
      nome: tipoParametro.nome,
      unidade: tipoParametro.unidade,
    }));
    this.criadoEm = estacao.criadoEm;
    this.atualizadoEm = estacao.atualizadoEm;
  }
}
/** Resposta do cadastro: única vez em que a chave de ingestão aparece. */
export class EstacaoCriadaRespostaDto extends EstacaoRespostaDto {
  chaveIngestao: string;

  constructor(estacao: EstacaoComSensores, chaveIngestao: string) {
    super(estacao);
    this.chaveIngestao = chaveIngestao;
  }
}
