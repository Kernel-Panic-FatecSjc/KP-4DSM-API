import {
  converterDuracaoParaMs,
  converterSameSite,
} from '../../../src/autenticacao/cookie.config';

describe('converterDuracaoParaMs', () => {
  it.each([
    ['30s', 30_000],
    ['15m', 900_000],
    ['1h', 3_600_000],
    ['7d', 604_800_000],
  ])('converte %s', (duracao, esperado) => {
    expect(converterDuracaoParaMs(duracao)).toBe(esperado);
  });

  it.each(['', '1x', 'h', '1.5h', '-1h'])('rejeita o formato "%s"', (duracao) => {
    expect(() => converterDuracaoParaMs(duracao)).toThrow(/Formato de duração inválido/);
  });
});

describe('converterSameSite', () => {
  it('normaliza caixa e espaços', () => {
    expect(converterSameSite(' Lax ')).toBe('lax');
    expect(converterSameSite('NONE')).toBe('none');
  });

  it('falha em valor fora da união aceita', () => {
    expect(() => converterSameSite('sim')).toThrow(/COOKIE_SAMESITE inválido/);
  });
});
