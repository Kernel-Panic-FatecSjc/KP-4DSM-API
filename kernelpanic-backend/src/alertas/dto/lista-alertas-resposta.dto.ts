import { ApiProperty } from '@nestjs/swagger';
import { AlertaRespostaDto } from './alerta-resposta.dto';

export class ListaAlertasRespostaDto {
  @ApiProperty({ type: [AlertaRespostaDto], description: 'Alertas da página.' })
  itens: AlertaRespostaDto[];
  @ApiProperty({ example: 25, description: 'Total de alertas do filtro, somando todas as páginas.' })
  total: number;
  @ApiProperty({ example: 1 })
  pagina: number;
  @ApiProperty({ example: 50, description: 'Tamanho da página.' })
  tamanho: number;

  constructor(itens: AlertaRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}
