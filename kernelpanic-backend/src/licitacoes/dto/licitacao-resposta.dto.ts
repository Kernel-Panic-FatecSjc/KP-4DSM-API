import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Licitacao } from '../../generated/prisma/client';
import { EsferaOrgao, ModalidadeLicitacao, StatusLicitacao } from '../../generated/prisma/client';

export class LicitacaoRespostaDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty({ example: 'PMSJC-2026' }) codigoIdentificador: string;
  @ApiProperty() numeroProcesso: string;
  @ApiProperty({ enum: ModalidadeLicitacao }) modalidade: ModalidadeLicitacao;
  @ApiProperty() objeto: string;
  @ApiProperty() numeroContrato: string;
  @ApiProperty({ format: 'date-time' }) inicioVigencia: Date;
  @ApiProperty({ format: 'date-time' }) fimVigencia: Date;
  @ApiProperty({ enum: StatusLicitacao }) status: StatusLicitacao;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' }) encerradaEm: Date | null;
  @ApiProperty() orgaoNome: string;
  @ApiPropertyOptional({ nullable: true }) orgaoCnpj: string | null;
  @ApiProperty({ enum: EsferaOrgao }) orgaoEsfera: EsferaOrgao;
  @ApiProperty() orgaoMunicipio: string;
  @ApiProperty() orgaoUf: string;
  @ApiProperty({ format: 'date-time' }) criadoEm: Date;
  @ApiProperty({ format: 'date-time' }) atualizadoEm: Date;
  @ApiPropertyOptional({ description: 'Só na listagem' }) quantidadeEstacoes?: number;
  @ApiPropertyOptional({ description: 'Só na listagem' }) quantidadeUsuarios?: number;

  constructor(licitacao: Licitacao & { _count?: { estacoes: number; usuarios: number } }) {
    this.id = licitacao.id;
    this.codigoIdentificador = licitacao.codigoIdentificador;
    this.numeroProcesso = licitacao.numeroProcesso;
    this.modalidade = licitacao.modalidade;
    this.objeto = licitacao.objeto;
    this.numeroContrato = licitacao.numeroContrato;
    this.inicioVigencia = licitacao.inicioVigencia;
    this.fimVigencia = licitacao.fimVigencia;
    this.status = licitacao.status;
    this.encerradaEm = licitacao.encerradaEm;
    this.orgaoNome = licitacao.orgaoNome;
    this.orgaoCnpj = licitacao.orgaoCnpj;
    this.orgaoEsfera = licitacao.orgaoEsfera;
    this.orgaoMunicipio = licitacao.orgaoMunicipio;
    this.orgaoUf = licitacao.orgaoUf;
    this.criadoEm = licitacao.criadoEm;
    this.atualizadoEm = licitacao.atualizadoEm;
    this.quantidadeEstacoes = licitacao._count?.estacoes;
    this.quantidadeUsuarios = licitacao._count?.usuarios;
  }
}

export class LicitacoesPaginadasRespostaDto {
  @ApiProperty({ type: LicitacaoRespostaDto, isArray: true }) itens: LicitacaoRespostaDto[];
  @ApiProperty({ minimum: 0 }) total: number;
  @ApiProperty({ minimum: 1 }) pagina: number;
  @ApiProperty({ minimum: 1 }) tamanho: number;

  constructor(itens: LicitacaoRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}
