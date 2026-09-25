export interface LeituraBrutaResposta {
  id: string;
  vidEstacao: string;
  recebidoEm: Date;
  unixtimeDispositivo: string;
  latitude: number;
  longitude: number;
  payload: unknown;
}

export class LeituraBrutaRespostaDto implements LeituraBrutaResposta {
  id: string;
  vidEstacao: string;
  recebidoEm: Date;
  unixtimeDispositivo: string;
  latitude: number;
  longitude: number;
  payload: unknown;

  constructor(leitura: LeituraBrutaResposta) {
    this.id = leitura.id;
    this.vidEstacao = leitura.vidEstacao;
    this.recebidoEm = leitura.recebidoEm;
    this.unixtimeDispositivo = leitura.unixtimeDispositivo;
    this.latitude = leitura.latitude;
    this.longitude = leitura.longitude;
    this.payload = leitura.payload;
  }
}