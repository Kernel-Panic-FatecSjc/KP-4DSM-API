import { ApiProperty } from '@nestjs/swagger';

export class IngestaoRespostaDto {
  @ApiProperty({ example: '3f2504e0-4f89-41d3-9a0c-0305e82c3301', description: 'Id da leitura bruta gravada.' })
  leituraBrutaId: string;

  @ApiProperty({ example: '5b0c4c1e-6a1f-4c55-9c8b-0f3f2f7f4a10' })
  estacaoId: string;

  @ApiProperty({ example: 2, description: 'Quantidade de sensores no pacote.' })
  sensoresRecebidos: number;

  @ApiProperty({ example: 1792869810, description: 'Unix time (segundos) em que a plataforma recebeu o pacote.' })
  recebidoEm: number;

  // true: o pacote foi guardado em leituras_brutas, mas a estação está inativa
  // e nenhuma medida (nem alarme) saiu dele. A resposta continua 202: um 409
  // faria o datalogger reenviar para sempre o que nunca vai ser aceito.
  @ApiProperty({ example: false, description: 'true: o pacote foi guardado, mas a estação está inativa e nenhuma medida (nem alarme) sai dele. Continua 202 para o dispositivo não reenviar.' })
  estacaoInativa: boolean;

  constructor(leituraBrutaId: string, estacaoId: string, sensoresRecebidos: number, recebidoEm: number, estacaoInativa: boolean) {
    this.leituraBrutaId = leituraBrutaId;
    this.estacaoId = estacaoId;
    this.sensoresRecebidos = sensoresRecebidos;
    this.recebidoEm = recebidoEm;
    this.estacaoInativa = estacaoInativa;
  }
}
