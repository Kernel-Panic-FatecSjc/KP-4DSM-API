import { Logger } from '@nestjs/common';
import type { ConfigService } from '@nestjs/config';
import type { IngestaoService } from '../../../../servicos/ingestao/ingestao.service';
import { AssinanteMqttService } from '../../../../servicos/ingestao/mqtt/assinante-mqtt.service';

describe('AssinanteMqttService', () => {
  const ingestao = { receber: jest.fn() };
  let assinante: AssinanteMqttService;
  const processar = (topico: string, corpo: unknown) =>
    (assinante as unknown as { processar(t: string, m: Buffer): Promise<void> }).processar(
      topico,
      Buffer.from(typeof corpo === 'string' ? corpo : JSON.stringify(corpo)),
    );

  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(Logger.prototype, 'warn').mockImplementation();
    ingestao.receber.mockResolvedValue(undefined);
    assinante = new AssinanteMqttService(ingestao as unknown as IngestaoService, { get: jest.fn() } as unknown as ConfigService);
  });

  it('repassa o pacote com o vid tirado do tópico', async () => {
    await processar('estacoes/AA:BB:CC:DD:EE:FF/telemetria', { unixtime: 1_760_000_000, leituras: { chuva: 1.5 } });

    expect(ingestao.receber).toHaveBeenCalledWith(
      expect.objectContaining({ vid: 'AA:BB:CC:DD:EE:FF', unixtime: 1_760_000_000, leituras: { chuva: 1.5 } }),
    );
    expect(assinante.mensagensRecusadas).toBe(0);
  });

  it('o vid do corpo não troca a estação do tópico (a ACL do broker é por tópico)', async () => {
    await processar('estacoes/v1/telemetria', { vid: 'outra', leituras: { chuva: 1 } });

    expect(ingestao.receber.mock.calls[0][0].vid).toBe('v1');
  });

  it.each([
    ['payload que não é JSON', 'estacoes/v1/telemetria', '{nao-json'],
    ['payload que não é objeto', 'estacoes/v1/telemetria', '42'],
    ['leituras fora do formato', 'estacoes/v1/telemetria', { leituras: { chuva: 'muito' } }],
    ['unixtime implausível', 'estacoes/v1/telemetria', { unixtime: 10, leituras: { chuva: 1 } }],
    ['tópico fora do formato', 'estacoes/v1/outro', { leituras: { chuva: 1 } }],
  ])('recusa %s sem repassar e conta para o /saude', async (_caso, topico, corpo) => {
    await processar(topico, corpo);

    expect(ingestao.receber).not.toHaveBeenCalled();
    expect(assinante.mensagensRecusadas).toBe(1);
  });

  it('sem MQTT_URL fica desligado (só a rota HTTP recebe)', () => {
    assinante.onApplicationBootstrap();
    expect(assinante.estado()).toBe('desligado');
  });
});
