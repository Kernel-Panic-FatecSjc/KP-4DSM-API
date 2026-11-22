'use client';

import { useEffect, useMemo, useState } from 'react';
import { api, type EsferaOrgaoApi, type LicitacaoApi, type ModalidadeLicitacao, type Paginado } from './api';

export const ROTULOS_MODALIDADE: Record<ModalidadeLicitacao, string> = {
  PREGAO: 'Pregão',
  CONCORRENCIA: 'Concorrência',
  CONCURSO: 'Concurso',
  LEILAO: 'Leilão',
  DIALOGO_COMPETITIVO: 'Diálogo competitivo',
  DISPENSA: 'Dispensa',
  INEXIGIBILIDADE: 'Inexigibilidade',
  OUTRA: 'Outra',
};

export const ROTULOS_ESFERA: Record<EsferaOrgaoApi, string> = {
  MUNICIPAL: 'Municipal',
  ESTADUAL: 'Estadual',
  FEDERAL: 'Federal',
};

/**
 * Licitações para filtros e rótulos da Tecsus. `ativo` falso (usuário de
 * licitação) não chama a API: ele já vê só a dele.
 */
export function useLicitacoes(ativo: boolean): LicitacaoApi[] {
  const [licitacoes, setLicitacoes] = useState<LicitacaoApi[]>([]);

  useEffect(() => {
    if (!ativo) return;
    let vivo = true;
    api<Paginado<LicitacaoApi>>('/licitacoes?tamanho=100')
      .then((resposta) => {
        if (vivo) setLicitacoes(resposta.itens);
      })
      .catch(() => {
        if (vivo) setLicitacoes([]);
      });
    return () => {
      vivo = false;
    };
  }, [ativo]);

  return licitacoes;
}

/** id da licitação → código, para as colunas "Licitação" das listagens da Tecsus. */
export function useCodigosLicitacao(ativo: boolean): Map<string, string> {
  const licitacoes = useLicitacoes(ativo);
  return useMemo(
    () => new Map(licitacoes.map((licitacao) => [licitacao.id, licitacao.codigoIdentificador])),
    [licitacoes],
  );
}
