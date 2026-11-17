import { StatusOperacionalEstacao, type Prisma } from '../../generated/prisma/client';
import { ApiProperty } from '@nestjs/swagger';

type EstacaoComSensores = Prisma.EstacaoGetPayload<{
  include: {
    parametros: { include: { tipoParametro: true } };
    licitacao: { select: { id: true; codigoIdentificador: true } };
  };
}>;

export class SensorDaEstacaoDto {
  @ApiProperty({ example: '11111111-1111-4111-8111-111111111111', description: 'Id do tipo de parâmetro (sensor).' })
  id!: string;

  @ApiProperty({ example: 'Temperatura' })
  nome!: string;

  @ApiProperty({ example: '°C' })
  unidade!: string;
}

export class LicitacaoDaEstacaoDto {
  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id!: string;

  @ApiProperty({ example: 'PMSJC-2026', description: 'Código identificador da licitação.' })
  codigoIdentificador!: string;
}

export class EstacaoRespostaDto {
  @ApiProperty({ format: 'uuid', example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  id: string;
  @ApiProperty({ example: 'Estação Centro' })
  nome: string;
  @ApiProperty({ example: 'Praça Afonso Pena, 100 - Centro' })
  endereco: string;
  @ApiProperty({ example: 'A4:CF:12:9B:77:01', description: 'Identificador do dispositivo (MAC ou UUID).' })
  vid: string;
  @ApiProperty({ example: -23.1896, description: 'Graus decimais (WGS84).' })
  latitude: number;
  @ApiProperty({ example: -45.8841, description: 'Graus decimais (WGS84).' })
  longitude: number;
  @ApiProperty({ enum: StatusOperacionalEstacao })
  statusOperacional: string;
  @ApiProperty({ example: true, description: 'Se a estação já tem chave de ingestão. A chave em si nunca é devolvida depois do cadastro.' })
  possuiChaveIngestao: boolean;
  @ApiProperty({ type: [SensorDaEstacaoDto], description: 'Sensores da estação.' })
  sensores: Array<{ id: string; nome: string; unidade: string }>;
  @ApiProperty({ type: LicitacaoDaEstacaoDto, description: 'Licitação à qual a estação pertence.' })
  licitacao: { id: string; codigoIdentificador: string };
  @ApiProperty({ format: 'date-time', example: '2026-11-08T14:00:00.000Z', description: 'Data de criação (ISO 8601, UTC).' })
  criadoEm: Date;
  @ApiProperty({ format: 'date-time', example: '2026-11-08T14:00:00.000Z', description: 'Data da última alteração (ISO 8601, UTC).' })
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
  @ApiProperty({ type: [EstacaoRespostaDto], description: 'Estações da página.' })
  itens: EstacaoRespostaDto[];
  @ApiProperty({ example: 120, description: 'Total de estações do filtro, somando todas as páginas.' })
  total: number;
  @ApiProperty({ example: 1 })
  pagina: number;
  @ApiProperty({ example: 50, description: 'Tamanho da página.' })
  tamanho: number;

  constructor(itens: EstacaoRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}

/** Resposta do cadastro: única vez em que a chave de ingestão aparece. */
export class EstacaoCriadaRespostaDto extends EstacaoRespostaDto {
  @ApiProperty({ example: 'k3J9...chave-secreta...', description: 'Chave de ingestão da estação (header `x-chave-estacao`). Aparece só nesta resposta.' })
  chaveIngestao: string;

  constructor(estacao: EstacaoComSensores, chaveIngestao: string) {
    super(estacao);
    this.chaveIngestao = chaveIngestao;
  }
}

export class ChaveIngestaoRespostaDto {
  @ApiProperty({ example: 'k3J9...chave-secreta...', description: 'Nova chave de ingestão (header `x-chave-estacao`). Aparece só nesta resposta; a anterior deixa de valer.' })
  chaveIngestao!: string;
}
