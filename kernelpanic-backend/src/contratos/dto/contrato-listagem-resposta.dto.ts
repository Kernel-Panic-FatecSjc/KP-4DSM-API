import { ApiProperty } from '@nestjs/swagger';
import type { Prisma } from '../../generated/prisma/client';
import { ContratoRespostaDto } from './contrato-resposta.dto';

type ContratoComOrgao = Prisma.ContratoGetPayload<{
  include: { orgao: true };
}>;

/// Item da listagem: o contrato com os dados do orgao (ja herdados de
/// ContratoRespostaDto) mais a quantidade de estacoes vinculadas.
export class ContratoListagemRespostaDto extends ContratoRespostaDto {
  @ApiProperty({
    example: 0,
    description:
      'Quantidade de estacoes vinculadas ao contrato. Retorna 0 enquanto o vinculo contrato-estacao (US13) nao estiver implementado',
  })
  quantidadeEstacoes: number;

  constructor(contrato: ContratoComOrgao, quantidadeEstacoes: number) {
    super(contrato);
    this.quantidadeEstacoes = quantidadeEstacoes;
  }
}

export class ContratosPaginadosRespostaDto {
  @ApiProperty({ type: ContratoListagemRespostaDto, isArray: true })
  itens: ContratoListagemRespostaDto[];

  @ApiProperty({
    example: 120,
    description: 'Total de contratos que atendem aos filtros (todas as paginas)',
  })
  total: number;

  @ApiProperty({ example: 1 })
  pagina: number;

  @ApiProperty({ example: 50 })
  tamanho: number;

  @ApiProperty({ example: 3 })
  totalPaginas: number;

  constructor(
    itens: ContratoListagemRespostaDto[],
    total: number,
    pagina: number,
    tamanho: number,
  ) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
    this.totalPaginas = Math.ceil(total / tamanho);
  }
}
