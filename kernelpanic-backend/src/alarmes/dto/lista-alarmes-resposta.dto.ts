import { ApiProperty } from '@nestjs/swagger';
import { AlarmeHistoricoRespostaDto } from './alarme-historico-resposta.dto';

export class ListaAlarmesRespostaDto {
  @ApiProperty({ type: [AlarmeHistoricoRespostaDto], description: 'Alarmes da página.' })
  itens: AlarmeHistoricoRespostaDto[];
  @ApiProperty({ example: 80, description: 'Total de alarmes do filtro, somando todas as páginas.' })
  total: number;
  @ApiProperty({ example: 1 })
  pagina: number;
  @ApiProperty({ example: 50, description: 'Tamanho da página.' })
  tamanho: number;

  constructor(itens: AlarmeHistoricoRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}
