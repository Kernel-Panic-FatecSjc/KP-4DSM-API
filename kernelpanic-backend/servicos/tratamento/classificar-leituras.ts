import { randomUUID } from 'node:crypto';
import { MotivoLeituraErro, StatusOperacionalEstacao } from '../../src/generated/prisma/client';
import { motivoForaDaFaixa } from './faixa-fisica';

export interface LeituraBrutaParaTratar {
  id: string;
  vidEstacao: string;
  payload: unknown;
  unixtimeDispositivo: bigint;
}

export interface EstacaoParaTratamento {
  id: string;
  licitacaoId: string;
  statusOperacional: StatusOperacionalEstacao;
  parametros: {
    id: string;
    tipoParametro: { nome: string; valorMinimo: number | null; valorMaximo: number | null };
  }[];
}

export interface MedidaParaGravar {
  parametroId: string;
  estacaoId: string;
  licitacaoId: string;
  valor: number;
  unixtime: bigint;
}

export interface LeituraErroParaGravar {
  id: string;
  leituraBrutaId: string;
  vidEstacao: string;
  nomeSensor: string;
  /** Nulo quando o sensor não tem parâmetro configurado na estação. */
  parametroId: string | null;
  licitacaoId: string | null;
  valor: number;
  unixtime: bigint;
  motivo: MotivoLeituraErro;
  valorMinimo: number | null;
  valorMaximo: number | null;
}

export interface Classificacao {
  medidas: MedidaParaGravar[];
  erros: LeituraErroParaGravar[];
}

/**
 * Decide o destino de cada sensor de uma leitura bruta (a regra que a
 * ingestão aplicava na hora de receber, agora no tratamento):
 * - estação inativa: nada vira medida, e o pacote fica só em leituras_brutas;
 * - sensor sem parâmetro na estação, ou valor fora da faixa física do tipo:
 *   vai para leituras_erro com o motivo (o PO aceitou descartar só a leitura
 *   fora da faixa, não o pacote inteiro);
 * - o resto vira medida, com a licitação da estação de agora (o histórico não
 *   muda de dono se a estação mudar de licitação depois).
 */
export function classificarLeitura(
  leitura: LeituraBrutaParaTratar,
  estacao: EstacaoParaTratamento | undefined,
): Classificacao {
  const medidas: MedidaParaGravar[] = [];
  const erros: LeituraErroParaGravar[] = [];
  const leituras = Object.entries((leitura.payload ?? {}) as Record<string, unknown>).filter(
    (entrada): entrada is [string, number] => typeof entrada[1] === 'number' && Number.isFinite(entrada[1]),
  );

  if (estacao?.statusOperacional === StatusOperacionalEstacao.INATIVA) {
    return { medidas, erros };
  }

  // O nome do sensor no payload casa com o "nome" do tipoParametro configurado
  // para a estação (o mesmo mapa que a ingestão expõe em /parametros).
  const mapaParametros = new Map((estacao?.parametros ?? []).map((p) => [p.tipoParametro.nome, p]));

  for (const [nomeSensor, valor] of leituras) {
    const parametro = mapaParametros.get(nomeSensor);
    const valorMinimo = parametro?.tipoParametro.valorMinimo ?? null;
    const valorMaximo = parametro?.tipoParametro.valorMaximo ?? null;

    const motivo = !estacao
      ? MotivoLeituraErro.ESTACAO_NAO_CADASTRADA
      : parametro
        ? motivoForaDaFaixa(valor, valorMinimo, valorMaximo)
        : MotivoLeituraErro.SENSOR_NAO_CONFIGURADO;

    if (estacao && parametro && !motivo) {
      medidas.push({
        parametroId: parametro.id,
        estacaoId: estacao.id,
        licitacaoId: estacao.licitacaoId,
        valor,
        unixtime: leitura.unixtimeDispositivo,
      });
      continue;
    }

    erros.push({
      id: randomUUID(),
      leituraBrutaId: leitura.id,
      vidEstacao: leitura.vidEstacao,
      nomeSensor,
      parametroId: parametro?.id ?? null,
      licitacaoId: estacao?.licitacaoId ?? null,
      valor,
      unixtime: leitura.unixtimeDispositivo,
      motivo: motivo ?? MotivoLeituraErro.SENSOR_NAO_CONFIGURADO,
      valorMinimo,
      valorMaximo,
    });
  }

  return { medidas, erros };
}
