import { ApiProperty } from '@nestjs/swagger';
import { AuditoriaRespostaDto } from './auditoria-resposta.dto';

export class ListaAuditoriaRespostaDto {
  @ApiProperty({ type: [AuditoriaRespostaDto], description: 'Registros da página, do mais recente para o mais antigo.' })
  itens: AuditoriaRespostaDto[];
  @ApiProperty({ example: 340, description: 'Total de registros do filtro, somando todas as páginas.' })
  total: number;
  @ApiProperty({ example: 1 })
  pagina: number;
  @ApiProperty({ example: 50, description: 'Tamanho da página.' })
  tamanho: number;

  constructor(itens: AuditoriaRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}
