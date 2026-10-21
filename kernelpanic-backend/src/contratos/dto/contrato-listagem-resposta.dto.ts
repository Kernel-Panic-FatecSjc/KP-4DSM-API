import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { StatusContrato } from '../../generated/prisma/client';
import { OrgaoContratoRespostaDto } from './contrato-resposta.dto';

export class ContratoListagemRespostaDto {
  @ApiProperty({ format: 'uuid' })
  id: string;

  @ApiProperty()
  numero: string;

  @ApiProperty()
  objeto: string;

  @ApiProperty({ format: 'date-time' })
  inicioVigencia: Date;

  @ApiProperty({ format: 'date-time' })
  fimVigencia: Date;

  @ApiProperty({ enum: StatusContrato })
  status: StatusContrato;

  @ApiProperty({ format: 'date-time' })
  criadoEm: Date;

  @ApiProperty({ format: 'date-time' })
  atualizadoEm: Date;

  @ApiPropertyOptional({ nullable: true, format: 'date-time' })
  encerradoEm: Date | null;

  @ApiProperty({ type: OrgaoContratoRespostaDto })
  orgao: OrgaoContratoRespostaDto;

  @ApiProperty({ minimum: 0, description: 'Quantidade de estações vinculadas ao contrato' })
  quantidadeEstacoes: number;

  constructor(contrato: {
    id: string;
    numero: string;
    objeto: string;
    inicioVigencia: Date;
    fimVigencia: Date;
    status: StatusContrato;
    criadoEm: Date;
    atualizadoEm: Date;
    encerradoEm: Date | null;
    orgao: ConstructorParameters<typeof OrgaoContratoRespostaDto>[0];
    quantidadeEstacoes: number;
  }) {
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
    this.quantidadeEstacoes = contrato.quantidadeEstacoes;
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
