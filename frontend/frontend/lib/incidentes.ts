import type { SeveridadeAlerta } from './api';

export interface FiltrosIncidentes {
  de: string;
  ate: string;
  severidade: SeveridadeAlerta | '';
  endereco: string;
  latitude: string;
  longitude: string;
  raioKm: string;
  toleranciaMinutos: string;
  licitacaoId: string;
}

function diaLocal(data: Date): string {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  return `${ano}-${mes}-${dia}`;
}

/** Últimos 30 dias, até hoje. */
export function filtrosIniciaisIncidentes(hoje = new Date()): FiltrosIncidentes {
  const inicio = new Date(hoje);
  inicio.setDate(inicio.getDate() - 30);
  return {
    de: diaLocal(inicio),
    ate: diaLocal(hoje),
    severidade: '',
    endereco: '',
    latitude: '',
    longitude: '',
    raioKm: '',
    toleranciaMinutos: '',
    licitacaoId: '',
  };
}

/**
 * Query da API. Os dias do formulário são do fuso de quem consulta: viram
 * instantes (00:00 e 23:59:59.999 locais), e não dias UTC.
 */
export function parametrosIncidentes(filtros: FiltrosIncidentes): URLSearchParams {
  const parametros = new URLSearchParams({
    de: new Date(`${filtros.de}T00:00:00`).toISOString(),
    ate: new Date(`${filtros.ate}T23:59:59.999`).toISOString(),
  });
  if (filtros.severidade) parametros.set('severidade', filtros.severidade);
  if (filtros.endereco.trim()) parametros.set('endereco', filtros.endereco.trim());
  if (filtros.latitude.trim() && filtros.longitude.trim()) {
    parametros.set('latitude', filtros.latitude.trim());
    parametros.set('longitude', filtros.longitude.trim());
    if (filtros.raioKm.trim()) parametros.set('raioKm', filtros.raioKm.trim());
  }
  if (filtros.toleranciaMinutos.trim()) parametros.set('toleranciaMinutos', filtros.toleranciaMinutos.trim());
  if (filtros.licitacaoId) parametros.set('licitacaoId', filtros.licitacaoId);
  return parametros;
}

/** "2 h 05 min", "45 min", "leitura única" (duração 0) ou "< 1 min". */
export function formatarDuracao(segundos: number): string {
  if (segundos <= 0) return 'leitura única';
  const minutos = Math.round(segundos / 60);
  if (minutos < 1) return '< 1 min';
  const horas = Math.floor(minutos / 60);
  const resto = minutos % 60;
  if (horas === 0) return `${resto} min`;
  if (horas < 24) return `${horas} h ${String(resto).padStart(2, '0')} min`;
  const dias = Math.floor(horas / 24);
  return `${dias} d ${horas % 24} h`;
}

export const SIMBOLO_OPERADOR: Record<string, string> = {
  MAIOR_QUE: '>',
  MENOR_QUE: '<',
  IGUAL_A: '=',
  DIFERENTE_DE: '≠',
  MAIOR_OU_IGUAL: '≥',
  MENOR_OU_IGUAL: '≤',
};
