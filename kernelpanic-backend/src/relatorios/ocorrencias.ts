import type { OperadorAlerta, SeveridadeAlerta, StatusAlarme } from '../generated/prisma/client';

// Agrupamento de alarmes em ocorrências (US10, "tempo de duração da anomalia").
// A decisão de calcular na consulta, em memória, está em
// docs/decisao-ocorrencias-alarmes.md.

/** Intervalo máximo, em minutos, entre duas leituras acima do limiar da mesma ocorrência. */
export const TOLERANCIA_PADRAO_MINUTOS = 15;
export const TOLERANCIA_MAXIMA_MINUTOS = 24 * 60;

export interface Responsavel {
  id: string;
  nome: string;
}

/** Um alarme com o que o agrupamento precisa: o alerta (regra) e a leitura que o disparou. */
export interface AlarmeParaOcorrencia {
  id: string;
  status: StatusAlarme;
  /** Instante da leitura no dispositivo (medidas.unixtime), em segundos. */
  unixtime: number;
  valor: number;
  reconhecidoEm: Date | null;
  reconhecidoPor: Responsavel | null;
  resolvidoEm: Date | null;
  resolvidoPor: Responsavel | null;
  observacao: string | null;
  alerta: {
    id: string;
    operador: OperadorAlerta;
    valorLimite: number;
    severidade: SeveridadeAlerta;
  };
  estacao: { id: string; nome: string };
  parametro: { id: string; nome: string; unidade: string };
}

export interface AcaoOcorrencia {
  em: Date;
  por: Responsavel | null;
}

export interface Ocorrencia {
  alertaId: string;
  severidade: SeveridadeAlerta;
  operador: OperadorAlerta;
  valorLimite: number;
  estacao: { id: string; nome: string };
  parametro: { id: string; nome: string; unidade: string };
  inicio: Date;
  fim: Date;
  /** fim - início, em segundos: 0 quando a anomalia teve uma leitura só. */
  duracaoSegundos: number;
  /** Leitura mais distante do limiar no sentido do operador. */
  valorPico: number;
  /** Leituras acima do limiar (alarmes) na ocorrência. */
  leituras: number;
  /** ABERTO se algum alarme ainda está aberto; RESOLVIDO só quando todos estão. */
  status: StatusAlarme;
  /** Primeiro reconhecimento entre os alarmes da ocorrência. */
  reconhecimento: AcaoOcorrencia | null;
  /** Última resolução, quando todos os alarmes estão resolvidos. */
  resolucao: AcaoOcorrencia | null;
  observacoes: string[];
}

/**
 * Agrupa alarmes consecutivos do mesmo alerta (e, portanto, da mesma estação
 * e parâmetro) em ocorrências: um intervalo maior que a tolerância entre duas
 * leituras acima do limiar fecha uma ocorrência e abre outra (gaps-and-islands).
 * A entrada não precisa vir ordenada. A saída sai do início mais recente para o
 * mais antigo.
 */
export function agruparOcorrencias(alarmes: AlarmeParaOcorrencia[], toleranciaMinutos = TOLERANCIA_PADRAO_MINUTOS): Ocorrencia[] {
  const toleranciaSegundos = toleranciaMinutos * 60;
  const ordenados = [...alarmes].sort(
    (a, b) => a.alerta.id.localeCompare(b.alerta.id) || a.unixtime - b.unixtime || a.id.localeCompare(b.id),
  );

  const ocorrencias: Ocorrencia[] = [];
  let grupo: AlarmeParaOcorrencia[] = [];
  for (const alarme of ordenados) {
    const anterior = grupo[grupo.length - 1];
    if (anterior && (anterior.alerta.id !== alarme.alerta.id || alarme.unixtime - anterior.unixtime > toleranciaSegundos)) {
      ocorrencias.push(montarOcorrencia(grupo));
      grupo = [];
    }
    grupo.push(alarme);
  }
  if (grupo.length > 0) ocorrencias.push(montarOcorrencia(grupo));

  return ocorrencias.sort((a, b) => b.inicio.getTime() - a.inicio.getTime() || a.alertaId.localeCompare(b.alertaId));
}

function montarOcorrencia(grupo: AlarmeParaOcorrencia[]): Ocorrencia {
  const primeiro = grupo[0];
  const ultimo = grupo[grupo.length - 1];
  const { alerta } = primeiro;

  const reconhecimentos = grupo
    .filter((alarme) => alarme.reconhecidoEm)
    .map((alarme) => ({ em: alarme.reconhecidoEm as Date, por: alarme.reconhecidoPor }))
    .sort((a, b) => a.em.getTime() - b.em.getTime());
  const todosResolvidos = grupo.every((alarme) => alarme.status === 'RESOLVIDO');
  const resolucoes = grupo
    .filter((alarme) => alarme.resolvidoEm)
    .map((alarme) => ({ em: alarme.resolvidoEm as Date, por: alarme.resolvidoPor }))
    .sort((a, b) => b.em.getTime() - a.em.getTime());

  return {
    alertaId: alerta.id,
    severidade: alerta.severidade,
    operador: alerta.operador,
    valorLimite: alerta.valorLimite,
    estacao: primeiro.estacao,
    parametro: primeiro.parametro,
    inicio: new Date(primeiro.unixtime * 1000),
    fim: new Date(ultimo.unixtime * 1000),
    duracaoSegundos: ultimo.unixtime - primeiro.unixtime,
    valorPico: valorPico(grupo.map((alarme) => alarme.valor), alerta.operador, alerta.valorLimite),
    leituras: grupo.length,
    status: grupo.some((alarme) => alarme.status === 'ABERTO') ? 'ABERTO' : todosResolvidos ? 'RESOLVIDO' : 'RECONHECIDO',
    reconhecimento: reconhecimentos[0] ?? null,
    resolucao: todosResolvidos ? (resolucoes[0] ?? null) : null,
    observacoes: [...new Set(grupo.map((alarme) => alarme.observacao).filter((texto): texto is string => Boolean(texto)))],
  };
}

/**
 * O pico depende do sentido da regra: o maior valor para "maior que", o menor
 * para "menor que" e, para igual/diferente, o mais distante do limite.
 */
export function valorPico(valores: number[], operador: OperadorAlerta, limite: number): number {
  switch (operador) {
    case 'MAIOR_QUE':
    case 'MAIOR_OU_IGUAL':
      return Math.max(...valores);
    case 'MENOR_QUE':
    case 'MENOR_OU_IGUAL':
      return Math.min(...valores);
    default:
      return valores.reduce((pico, valor) => (Math.abs(valor - limite) > Math.abs(pico - limite) ? valor : pico));
  }
}
