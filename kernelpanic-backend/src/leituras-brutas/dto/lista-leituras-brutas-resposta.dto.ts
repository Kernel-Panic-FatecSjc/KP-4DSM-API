import { LeituraBrutaRespostaDto } from './leitura-bruta-resposta.dto';

export class ListaLeiturasBrutasRespostaDto {
  constructor(
    public itens: LeituraBrutaRespostaDto[],
    public total: number,
    public pagina: number,
    public tamanho: number,
  ) {}
}