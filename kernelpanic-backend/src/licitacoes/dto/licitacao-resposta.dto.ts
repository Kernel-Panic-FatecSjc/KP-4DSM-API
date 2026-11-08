import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import type { Licitacao } from '../../generated/prisma/client';
import { EsferaOrgao, ModalidadeLicitacao, StatusLicitacao } from '../../generated/prisma/client';

export class LicitacaoRespostaDto {
  @ApiProperty({ format: 'uuid', example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' }) id: string;
  @ApiProperty({ example: 'PMSJC-2026', description: 'Código identificador da licitação.' }) codigoIdentificador: string;
  @ApiProperty({ example: '2026/00123', description: 'Número do processo administrativo.' }) numeroProcesso: string;
  @ApiProperty({ enum: ModalidadeLicitacao, description: 'Modalidade da licitação.' }) modalidade: ModalidadeLicitacao;
  @ApiProperty({ example: 'Monitoramento meteorológico municipal', description: 'Objeto da licitação.' }) objeto: string;
  @ApiProperty({ example: 'CT-045/2026', description: 'Número do contrato.' }) numeroContrato: string;
  @ApiProperty({ format: 'date-time', example: '2026-01-01T00:00:00.000Z', description: 'Início da vigência (ISO 8601, UTC).' }) inicioVigencia: Date;
  @ApiProperty({ format: 'date-time', example: '2027-01-01T00:00:00.000Z', description: 'Fim da vigência (ISO 8601, UTC).' }) fimVigencia: Date;
  @ApiProperty({ enum: StatusLicitacao, description: 'Situação da licitação.' }) status: StatusLicitacao;
  @ApiPropertyOptional({ nullable: true, format: 'date-time', example: null, description: 'Quando foi encerrada; null enquanto não encerrada.' }) encerradaEm: Date | null;
  @ApiProperty({ example: 'Prefeitura de São José dos Campos', description: 'Nome do órgão contratante.' }) orgaoNome: string;
  @ApiPropertyOptional({ type: String, nullable: true, example: '46.643.466/0001-06', description: 'CNPJ do órgão, quando informado.' }) orgaoCnpj: string | null;
  @ApiProperty({ enum: EsferaOrgao, description: 'Esfera do órgão.' }) orgaoEsfera: EsferaOrgao;
  @ApiProperty({ example: 'São José dos Campos', description: 'Município do órgão.' }) orgaoMunicipio: string;
  @ApiProperty({ example: 'SP', description: 'UF do órgão.' }) orgaoUf: string;
  @ApiProperty({ format: 'date-time', example: '2026-11-08T14:00:00.000Z', description: 'Data de criação (ISO 8601, UTC).' }) criadoEm: Date;
  @ApiProperty({ format: 'date-time', example: '2026-11-08T14:00:00.000Z', description: 'Data da última alteração (ISO 8601, UTC).' }) atualizadoEm: Date;
  @ApiPropertyOptional({ example: 4, description: 'Só na listagem' }) quantidadeEstacoes?: number;
  @ApiPropertyOptional({ example: 3, description: 'Só na listagem' }) quantidadeUsuarios?: number;

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
  @ApiProperty({ type: LicitacaoRespostaDto, isArray: true, description: 'Licitações da página.' }) itens: LicitacaoRespostaDto[];
  @ApiProperty({ minimum: 0, example: 12, description: 'Total do filtro, somando todas as páginas.' }) total: number;
  @ApiProperty({ minimum: 1, example: 1, description: 'Página atual.' }) pagina: number;
  @ApiProperty({ minimum: 1, example: 50, description: 'Itens por página.' }) tamanho: number;

  constructor(itens: LicitacaoRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}
