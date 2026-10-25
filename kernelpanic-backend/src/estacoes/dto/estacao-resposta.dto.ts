import type { Prisma } from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

type EstacaoComSensores = Prisma.EstacaoGetPayload<{
  include: {
    parametros: { include: { tipoParametro: true } };
    licitacao: { select: { id: true; codigoIdentificador: true } };
  };
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
  @ApiProperty()
  possuiChaveIngestao: boolean;
  @ApiProperty({ type: 'array', items: { type: 'object' } })
  sensores: Array<{ id: string; nome: string; unidade: string }>;
  @ApiProperty({
    description: 'Licitação à qual a estação pertence',
    example: { id: 'uuid', codigoIdentificador: 'PMSJC-2026' },
  })
  licitacao: { id: string; codigoIdentificador: string };
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
    this.possuiChaveIngestao = Boolean(estacao.chaveIngestaoHash);
    this.sensores = estacao.parametros.map(({ tipoParametro }) => ({
      id: tipoParametro.id,
      nome: tipoParametro.nome,
      unidade: tipoParametro.unidade,
    }));
    this.licitacao = estacao.licitacao;
    this.criadoEm = estacao.criadoEm;
    this.atualizadoEm = estacao.atualizadoEm;
  }
}

export class ListaEstacoesRespostaDto {
  constructor(
    public itens: EstacaoRespostaDto[],
    public total: number,
    public pagina: number,
    public tamanho: number,
  ) {}
}

/** Resposta do cadastro: única vez em que a chave de ingestão aparece. */
export class EstacaoCriadaRespostaDto extends EstacaoRespostaDto {
  chaveIngestao: string;

  constructor(estacao: EstacaoComSensores, chaveIngestao: string) {
    super(estacao);
    this.chaveIngestao = chaveIngestao;
  }
}
