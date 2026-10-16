import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../../generated/prisma/client';
import { StatusContrato } from '../../generated/prisma/client';

type ContratoComOrgao = Prisma.ContratoGetPayload<{
  include: { orgao: true };
}>;

export class OrgaoContratoRespostaDto {
  @ApiProperty({ example: '2d0f7b6f-1a40-4a65-9a4f-650bbafc648e' })
  id!: string;

  @ApiProperty({ example: 'Prefeitura Municipal de Sao Jose dos Campos' })
  nome!: string;

  @ApiProperty({ type: String, nullable: true, example: '46643466000106' })
  cnpj!: string | null;

  @ApiProperty({ example: true })
  ativo!: boolean;
}

export class ContratoRespostaDto {
  @ApiProperty({ example: '9b1deb4d-3b7d-4bad-9bdd-2b0d7b3dcb6d' })
  id: string;

  @ApiProperty({ example: 'CTR-2026-001' })
  numero: string;

  @ApiProperty({ example: 'Monitoramento hidrometeorologico municipal' })
  objeto: string;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-01-01T00:00:00.000Z',
  })
  inicioVigencia: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    example: '2026-12-31T00:00:00.000Z',
  })
  fimVigencia: Date;

  @ApiProperty({ enum: StatusContrato, example: StatusContrato.RASCUNHO })
  status: string;

  @ApiProperty({ type: OrgaoContratoRespostaDto })
  orgao: OrgaoContratoRespostaDto;

  @ApiProperty({ type: String, format: 'date-time' })
  criadoEm: Date;

  @ApiProperty({ type: String, format: 'date-time' })
  atualizadoEm: Date;

  @ApiProperty({
    type: String,
    format: 'date-time',
    nullable: true,
    description: 'Preenchido ao encerrar',
  })
  encerradoEm: Date | null;

  constructor(contrato: ContratoComOrgao) {
    this.id = contrato.id;
    this.numero = contrato.numero;
    this.objeto = contrato.objeto;
    this.inicioVigencia = contrato.inicioVigencia;
    this.fimVigencia = contrato.fimVigencia;
    this.status = contrato.status;
    this.orgao = {
      id: contrato.orgao.id,
      nome: contrato.orgao.nome,
      cnpj: contrato.orgao.cnpj,
      ativo: contrato.orgao.ativo,
    };
    this.criadoEm = contrato.criadoEm;
    this.atualizadoEm = contrato.atualizadoEm;
    this.encerradoEm = contrato.encerradoEm;
  }
}
