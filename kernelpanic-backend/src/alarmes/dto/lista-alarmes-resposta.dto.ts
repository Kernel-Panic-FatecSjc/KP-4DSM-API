import { AlarmeHistoricoRespostaDto } from './alarme-historico-resposta.dto';

export class ListaAlarmesRespostaDto {
  constructor(
    public itens: AlarmeHistoricoRespostaDto[],
    public total: number,
    public pagina: number,
    public tamanho: number,
  ) {}
}
