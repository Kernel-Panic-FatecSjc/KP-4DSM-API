export class IngestaoRespostaDto {
  constructor(
    public leituraBrutaId: string,
    public estacaoId: string,
    public sensoresRecebidos: number,
    public recebidoEm: number,
  ) {}
}
