import {
  TOLERANCIA_FUTURO_SEGUNDOS,
  UNIXTIME_MINIMO,
  unixtimeEhPlausivel,
} from '../../../src/ingestao/unixtime-plausivel.validator';

describe('unixtimeEhPlausivel', () => {
  const agora = Date.parse('2026-09-16T12:00:00Z');
  const agoraEmSegundos = Math.floor(agora / 1000);

  it('aceita um instante recente', () => {
    expect(unixtimeEhPlausivel(agoraEmSegundos - 60, agora)).toBe(true);
  });

  it('aceita exatamente o limite inferior', () => {
    expect(unixtimeEhPlausivel(UNIXTIME_MINIMO, agora)).toBe(true);
  });

  it('rejeita relógio zerado do datalogger', () => {
    expect(unixtimeEhPlausivel(0, agora)).toBe(false);
    expect(unixtimeEhPlausivel(UNIXTIME_MINIMO - 1, agora)).toBe(false);
  });

  it('tolera relógio levemente adiantado, mas não o futuro distante', () => {
    expect(unixtimeEhPlausivel(agoraEmSegundos + TOLERANCIA_FUTURO_SEGUNDOS, agora)).toBe(true);
    expect(unixtimeEhPlausivel(agoraEmSegundos + TOLERANCIA_FUTURO_SEGUNDOS + 1, agora)).toBe(false);
  });

  it('rejeita valores não inteiros (milissegundos enviados por engano)', () => {
    expect(unixtimeEhPlausivel(agoraEmSegundos + 0.5, agora)).toBe(false);
    expect(unixtimeEhPlausivel(agora, agora)).toBe(false);
  });
});
