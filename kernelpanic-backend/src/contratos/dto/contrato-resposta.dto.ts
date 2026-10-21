import type { Prisma } from '../../generated/prisma/client';
import { StatusContrato } from '../../generated/prisma/client';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

type ContratoComOrgao = Prisma.ContratoGetPayload<{ include: { orgao: true } }>;

export class OrgaoContratoRespostaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty()
  nome: string;
  @ApiPropertyOptional({ nullable: true, example: '12345678000190' })
  cnpj: string | null;

  constructor(orgao: ContratoComOrgao['orgao']) {
    this.id = orgao.id;
    this.nome = orgao.nome;
    this.cnpj = orgao.cnpj;
  }
}

export class ContratoRespostaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;
  @ApiProperty({ example: 'CTR-2026-001' })
  numero: string;
  @ApiProperty()
  objeto: string;
  @ApiProperty({ format: 'date-time' })
  inicioVigencia: Date;
  @ApiProperty({ format: 'date-time' })
  fimVigencia: Date;
  @ApiProperty({ enum: StatusContrato })
  status: string;
  @ApiProperty({ format: 'date-time' })
  criadoEm: Date;
  @ApiProperty({ format: 'date-time' })
  atualizadoEm: Date;
  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  encerradoEm: Date | null;
  @ApiProperty({ type: OrgaoContratoRespostaDto })
  orgao: OrgaoContratoRespostaDto;

  constructor(contrato: ContratoComOrgao) {
    this.id = contrato.id;
    this.numero = contrato.numero;
    this.objeto = contrato.objeto;
    this.inicioVigencia = contrato.inicioVigencia;
    this.fimVigencia = contrato.fimVigencia;
    this.status = contrato.status;
    this.criadoEm = contrato.criadoEm;
    this.atualizadoEm = contrato.atualizadoEm;
    this.encerradoEm = contrato.encerradoEm;
    this.orgao = new OrgaoContratoRespostaDto(contrato.orgao);
  }
}

export class ContratoListagemRespostaDto extends ContratoRespostaDto {
  @ApiProperty({
    description: 'Quantidade de estações vinculadas ao contrato',
    minimum: 0,
  })
  quantidadeEstacoes: number;

  constructor(contrato: ContratoComOrgao, quantidadeEstacoes: number) {
    super(contrato);
    this.quantidadeEstacoes = quantidadeEstacoes;
  }
}

export class ContratosPaginadosRespostaDto {
  @ApiProperty({ type: ContratoListagemRespostaDto, isArray: true })
  contratos: ContratoListagemRespostaDto[];

  @ApiProperty({ minimum: 0 })
  total: number;

  @ApiProperty({ minimum: 1 })
  pagina: number;

  @ApiProperty({ minimum: 1, maximum: 100 })
  tamanho: number;

  constructor(
    contratos: ContratoListagemRespostaDto[],
    total: number,
    pagina: number,
    tamanho: number,
  ) {
    this.contratos = contratos;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}
