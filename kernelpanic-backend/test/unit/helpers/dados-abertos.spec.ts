import { BadRequestException } from '@nestjs/common';
import { periodoDaConsulta } from '../../../src/dados-abertos/dados-abertos.service';
import { resolverFormato } from '../../../src/dados-abertos/formato';

describe('resolverFormato', () => {
  it('?formato vale antes do Accept', () => {
    expect(resolverFormato('json', 'text/csv')).toBe('json');
    expect(resolverFormato('csv', 'application/json')).toBe('csv');
  });

  it('sem ?formato usa o Accept, e sem nenhum dos dois devolve JSON', () => {
    expect(resolverFormato(undefined, 'text/csv')).toBe('csv');
    expect(resolverFormato(undefined, 'application/json')).toBe('json');
    expect(resolverFormato(undefined, undefined)).toBe('json');
  });
});

describe('periodoDaConsulta', () => {
  it('data sem hora em `ate` vale o dia inteiro (UTC)', () => {
    const { ate } = periodoDaConsulta({ de: '2026-01-01', ate: '2026-01-02', granularidade: 'hora' });

    expect(ate.toISOString()).toBe('2026-01-02T23:59:59.999Z');
  });

  it('aceita 31 dias na hora e 366 no dia, e barra acima disso', () => {
    expect(() => periodoDaConsulta({ de: '2026-01-01', ate: '2026-01-31', granularidade: 'hora' })).not.toThrow();
    expect(() => periodoDaConsulta({ de: '2026-01-01', ate: '2026-02-05', granularidade: 'hora' })).toThrow(BadRequestException);
    expect(() => periodoDaConsulta({ de: '2026-01-01', ate: '2026-12-31', granularidade: 'dia' })).not.toThrow();
    expect(() => periodoDaConsulta({ de: '2025-01-01', ate: '2026-12-31', granularidade: 'dia' })).toThrow(BadRequestException);
  });

  it('barra início depois do fim', () => {
    expect(() => periodoDaConsulta({ de: '2026-02-01', ate: '2026-01-01', granularidade: 'dia' })).toThrow(BadRequestException);
  });
});
