import { ApiProperty } from '@nestjs/swagger';
import { LeituraBrutaRespostaDto } from './leitura-bruta-resposta.dto';

export class ListaLeiturasBrutasRespostaDto {
  @ApiProperty({ type: [LeituraBrutaRespostaDto], description: 'Leituras da página, da mais recente para a mais antiga.' })
  itens: LeituraBrutaRespostaDto[];
  @ApiProperty({ example: 5400, description: 'Total de leituras do filtro, somando todas as páginas.' })
  total: number;
  @ApiProperty({ example: 1 })
  pagina: number;
  @ApiProperty({ example: 50, description: 'Tamanho da página.' })
  tamanho: number;

  constructor(itens: LeituraBrutaRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}
