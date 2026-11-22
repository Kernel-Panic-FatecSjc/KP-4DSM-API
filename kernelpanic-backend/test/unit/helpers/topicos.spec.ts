import { papelDaEstacao, topicoTelemetria, vidDoTopico } from '../../../src/broker/topicos';

describe('tópicos MQTT', () => {
  it('monta e lê estacoes/{vid}/telemetria', () => {
    expect(topicoTelemetria('AA:BB:CC:DD:EE:FF')).toBe('estacoes/AA:BB:CC:DD:EE:FF/telemetria');
    expect(vidDoTopico('estacoes/AA:BB:CC:DD:EE:FF/telemetria')).toBe('AA:BB:CC:DD:EE:FF');
    expect(papelDaEstacao('v1')).toBe('estacao-v1');
  });

  it('recusa tópico fora do formato', () => {
    for (const topico of ['estacoes//telemetria', 'estacoes/v1/outro', 'outro/v1/telemetria', 'estacoes/v1/telemetria/x']) {
      expect(vidDoTopico(topico)).toBeNull();
    }
  });
});
