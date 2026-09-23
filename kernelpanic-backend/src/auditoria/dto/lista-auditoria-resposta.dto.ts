import { AuditoriaRespostaDto } from './auditoria-resposta.dto';

export class ListaAuditoriaRespostaDto {
  itens: AuditoriaRespostaDto[];
  total: number;
  pagina: number;
  tamanho: number;

  constructor(itens: AuditoriaRespostaDto[], total: number, pagina: number, tamanho: number) {
    this.itens = itens;
    this.total = total;
    this.pagina = pagina;
    this.tamanho = tamanho;
  }
}