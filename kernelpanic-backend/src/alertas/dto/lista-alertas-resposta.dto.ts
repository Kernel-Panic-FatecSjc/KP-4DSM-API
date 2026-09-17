import { AlertaRespostaDto } from './alerta-resposta.dto';

export class ListaAlertasRespostaDto {
  constructor(
    public itens: AlertaRespostaDto[],
    public total: number,
    public pagina: number,
    public tamanho: number,
  ) {}
}
