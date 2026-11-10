import { describe, expect, it } from 'vitest';
import { filtrosIniciaisIncidentes, formatarDuracao, parametrosIncidentes } from '@/lib/incidentes';

describe('formatarDuracao', () => {
  it('formata leitura única, minutos, horas e dias', () => {
    expect(formatarDuracao(0)).toBe('leitura única');
    expect(formatarDuracao(20)).toBe('< 1 min');
    expect(formatarDuracao(45 * 60)).toBe('45 min');
    expect(formatarDuracao(2 * 3600 + 5 * 60)).toBe('2 h 05 min');
    expect(formatarDuracao(26 * 3600)).toBe('1 d 2 h');
  });
});

describe('parametrosIncidentes', () => {
  const base = filtrosIniciaisIncidentes(new Date(2026, 10, 8, 10, 0));

  it('padrão: últimos 30 dias, com o dia inteiro no fuso local', () => {
    expect(base.de).toBe('2026-10-09');
    expect(base.ate).toBe('2026-11-08');
    const parametros = parametrosIncidentes(base);
    expect(parametros.get('de')).toBe(new Date(2026, 9, 9, 0, 0, 0).toISOString());
    expect(parametros.get('ate')).toBe(new Date(2026, 10, 8, 23, 59, 59, 999).toISOString());
    expect([...parametros.keys()]).toEqual(['de', 'ate']);
  });

  it('só manda o raio com latitude e longitude juntas', () => {
    expect(parametrosIncidentes({ ...base, latitude: '-23', raioKm: '10' }).has('raioKm')).toBe(false);
    const comRegiao = parametrosIncidentes({ ...base, latitude: '-23.1', longitude: '-45.8', raioKm: '10', severidade: 'ALERTA', endereco: ' Centro ' });
    expect(Object.fromEntries(comRegiao)).toMatchObject({
      latitude: '-23.1',
      longitude: '-45.8',
      raioKm: '10',
      severidade: 'ALERTA',
      endereco: 'Centro',
    });
  });
});
