export class IngestaoRespostaDto {
  constructor(
    public leituraBrutaId: string,
    public estacaoId: string,
    public sensoresRecebidos: number,
    public recebidoEm: number,
    // true: o pacote foi guardado em leituras_brutas, mas a estação está inativa
    // e nenhuma medida (nem alarme) saiu dele. A resposta continua 202: um 409
    // faria o datalogger reenviar para sempre o que nunca vai ser aceito.
    public estacaoInativa: boolean,
  ) {}
}
