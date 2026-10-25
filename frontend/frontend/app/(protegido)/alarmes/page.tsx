'use client';

import { ChevronLeft, ChevronRight, ShieldCheck } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import {
  api,
  ErroApi,
  type AlarmeHistorico,
  type FiltrosAlarmes,
  type FiltrosAlertas,
  type ListaAlarmes,
  type ListaAlertas,
  type OpcoesFiltroAlarmes,
  type OpcoesFiltroAlertas,
  type SeveridadeAlerta,
  type StatusAlarme,
} from '@/lib/api';
import { useRouter } from 'next/navigation';
import { ehTecsus, podeOperar } from '@/lib/perfil';
import { cn } from '@/lib/utils';

const LABEL_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'Atenção',
  ALERTA: 'Alerta',
  EMERGENCIA: 'Emergência',
};

const COR_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'bg-aqua',
  ALERTA: 'bg-warning',
  EMERGENCIA: 'bg-critical',
};

const LABEL_STATUS: Record<StatusAlarme, string> = {
  ABERTO: 'Aberto',
  RECONHECIDO: 'Reconhecido',
  RESOLVIDO: 'Resolvido',
};

const COR_STATUS: Record<StatusAlarme, string> = {
  ABERTO: 'bg-critical',
  RECONHECIDO: 'bg-aqua',
  RESOLVIDO: 'bg-lime',
};

// O status só avança (a API devolve 409 ao voltar): estes são os próximos de cada um.
const PROXIMOS_STATUS: Record<StatusAlarme, { status: StatusAlarme; rotulo: string }[]> = {
  ABERTO: [
    { status: 'RECONHECIDO', rotulo: 'Reconhecer' },
    { status: 'RESOLVIDO', rotulo: 'Resolver' },
  ],
  RECONHECIDO: [{ status: 'RESOLVIDO', rotulo: 'Resolver' }],
  RESOLVIDO: [],
};

/** Só a Tecsus manda licitacaoId; vazio = todas. */
function comLicitacao(caminho: string, licitacaoId: string): string {
  if (!licitacaoId) return caminho;
  return `${caminho}${caminho.includes('?') ? '&' : '?'}licitacaoId=${encodeURIComponent(licitacaoId)}`;
}

function montarQuery(filtros: FiltrosAlarmes): string {
  const parametros = new URLSearchParams();
  if (filtros.estacaoId) parametros.set('estacaoId', filtros.estacaoId);
  if (filtros.tipoParametroId) parametros.set('tipoParametroId', filtros.tipoParametroId);
  if (filtros.severidade) parametros.set('severidade', filtros.severidade);
  if (filtros.status) parametros.set('status', filtros.status);
  if (filtros.de) parametros.set('de', new Date(filtros.de).toISOString());
  if (filtros.ate) parametros.set('ate', new Date(filtros.ate).toISOString());
  parametros.set('pagina', String(filtros.pagina ?? 1));
  return parametros.toString();
}

function montarQueryAlertas(filtros: FiltrosAlertas): string {
  const parametros = new URLSearchParams();
  if (filtros.estacaoId) parametros.set('estacaoId', filtros.estacaoId);
  if (filtros.tipoParametroId) parametros.set('tipoParametroId', filtros.tipoParametroId);
  if (filtros.severidade) parametros.set('severidade', filtros.severidade);
  if (filtros.ativo !== undefined) parametros.set('ativo', String(filtros.ativo));
  parametros.set('pagina', String(filtros.pagina ?? 1));
  return parametros.toString();
}

function FiltroCampo({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase text-muted-foreground">{label}</label>
      {children}
    </div>
  );
}

export default function AlarmesPage() {
  const router = useRouter();
  const usuario = useUsuario();
  const tecsus = ehTecsus(usuario);
  const operador = podeOperar(usuario);
  const [licitacaoId, setLicitacaoId] = useState('');
  const [alarmeAtualizando, setAlarmeAtualizando] = useState<string | null>(null);
  const [opcoes, setOpcoes] = useState<OpcoesFiltroAlarmes | null>(null);
  const [resultado, setResultado] = useState<ListaAlarmes | null>(null);
  const [filtros, setFiltros] = useState<FiltrosAlarmes>({ pagina: 1 });
  const [erro, setErro] = useState<string | null>(null);

  const [opcoesAlertas, setOpcoesAlertas] = useState<OpcoesFiltroAlertas | null>(null);
  const [resultadoAlertas, setResultadoAlertas] = useState<ListaAlertas | null>(null);
  const [filtrosAlertas, setFiltrosAlertas] = useState<FiltrosAlertas>({ pagina: 1 });
  const [erroAlertas, setErroAlertas] = useState<string | null>(null);

  const carregarHistorico = useCallback(
    async (filtrosAtuais: FiltrosAlarmes) => {
      setErro(null);
      try {
        const dados = await api<ListaAlarmes>(comLicitacao(`/alarmes?${montarQuery(filtrosAtuais)}`, licitacaoId));
        setResultado(dados);
      } catch (erroCapturado) {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.push('/login');
          return;
        }
        setErro('Erro ao carregar histórico de alarmes');
      }
    },
    [router, licitacaoId],
  );

  useEffect(() => {
    api<OpcoesFiltroAlarmes>(comLicitacao('/alarmes/filtros', licitacaoId))
      .then(setOpcoes)
      .catch((erroCapturado) => {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.push('/login');
        }
      });
  }, [router, licitacaoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega o histórico sempre que os filtros mudam
    carregarHistorico(filtros);
  }, [filtros, carregarHistorico]);

  const carregarAlertas = useCallback(
    async (filtrosAtuais: FiltrosAlertas) => {
      setErroAlertas(null);
      try {
        const dados = await api<ListaAlertas>(
          comLicitacao(`/alertas?${montarQueryAlertas(filtrosAtuais)}`, licitacaoId),
        );
        setResultadoAlertas(dados);
      } catch (erroCapturado) {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.push('/login');
          return;
        }
        setErroAlertas('Erro ao carregar alertas configurados');
      }
    },
    [router, licitacaoId],
  );

  useEffect(() => {
    api<OpcoesFiltroAlertas>(comLicitacao('/alertas/filtros', licitacaoId))
      .then(setOpcoesAlertas)
      .catch((erroCapturado) => {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.push('/login');
        }
      });
  }, [router, licitacaoId]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega os alertas configurados sempre que os filtros mudam
    carregarAlertas(filtrosAlertas);
  }, [filtrosAlertas, carregarAlertas]);

  function atualizarFiltro<K extends keyof FiltrosAlarmes>(campo: K, valor: FiltrosAlarmes[K]) {
    setFiltros((atual) => ({ ...atual, [campo]: valor || undefined, pagina: 1 }));
  }

  function irParaPagina(pagina: number) {
    setFiltros((atual) => ({ ...atual, pagina }));
  }

  function atualizarFiltroAlertas<K extends keyof FiltrosAlertas>(campo: K, valor: FiltrosAlertas[K]) {
    setFiltrosAlertas((atual) => ({
      ...atual,
      [campo]: valor === '' || valor === undefined ? undefined : valor,
      pagina: 1,
    }));
  }

  function irParaPaginaAlertas(pagina: number) {
    setFiltrosAlertas((atual) => ({ ...atual, pagina }));
  }

  function alterarLicitacao(novaLicitacaoId: string) {
    // Estação e parâmetro escolhidos podem não existir na nova licitação.
    setLicitacaoId(novaLicitacaoId);
    setFiltros({ pagina: 1 });
    setFiltrosAlertas({ pagina: 1 });
  }

  async function alterarStatus(alarme: AlarmeHistorico, status: StatusAlarme) {
    setAlarmeAtualizando(alarme.id);
    setErro(null);
    try {
      await api<AlarmeHistorico>(`/alarmes/${alarme.id}`, {
        method: 'PATCH',
        body: JSON.stringify({ status }),
      });
      await carregarHistorico(filtros);
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
        router.push('/login');
        return;
      }
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao atualizar o status do alarme');
    } finally {
      setAlarmeAtualizando(null);
    }
  }

  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.tamanho)) : 1;
  const totalPaginasAlertas = resultadoAlertas
    ? Math.max(1, Math.ceil(resultadoAlertas.total / resultadoAlertas.tamanho))
    : 1;

  return (
    <div className="space-y-5">
      <PageHeading
        title="Histórico de Alertas"
        description="Consulta global de ocorrências disparadas, com filtros por estação, parâmetro, severidade, status e período."
      />

      {tecsus && (
        <section className="rise flex max-w-md flex-col gap-1" aria-label="Filtro de licitação">
          <label htmlFor="licitacao" className="font-mono text-[10px] uppercase text-muted-foreground">
            Licitação
          </label>
          <SeletorLicitacao
            id="licitacao"
            valor={licitacaoId}
            onChange={alterarLicitacao}
            rotuloTodas="Todas as licitações"
          />
        </section>
      )}

      <section
        className="rise delay-1 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"
        aria-label="Filtros"
      >
        <FiltroCampo label="Estação">
          <Select
            value={filtros.estacaoId ?? ''}
            onChange={(e) => atualizarFiltro('estacaoId', e.target.value)}
            className="font-mono text-[11px]"
          >
            <option value="">Todas</option>
            {opcoes?.estacoes.map((estacao) => (
              <option key={estacao.id} value={estacao.id}>
                {estacao.nome}
              </option>
            ))}
          </Select>
        </FiltroCampo>

        <FiltroCampo label="Parâmetro">
          <Select
            value={filtros.tipoParametroId ?? ''}
            onChange={(e) => atualizarFiltro('tipoParametroId', e.target.value)}
            className="font-mono text-[11px]"
          >
            <option value="">Todos</option>
            {opcoes?.tiposParametro.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nome}
              </option>
            ))}
          </Select>
        </FiltroCampo>

        <FiltroCampo label="Severidade">
          <Select
            value={filtros.severidade ?? ''}
            onChange={(e) => atualizarFiltro('severidade', e.target.value as SeveridadeAlerta)}
            className="font-mono text-[11px]"
          >
            <option value="">Todas</option>
            {opcoes?.severidades.map((severidade) => (
              <option key={severidade} value={severidade}>
                {LABEL_SEVERIDADE[severidade]}
              </option>
            ))}
          </Select>
        </FiltroCampo>

        <FiltroCampo label="Status">
          <Select
            value={filtros.status ?? ''}
            onChange={(e) => atualizarFiltro('status', e.target.value as StatusAlarme)}
            className="font-mono text-[11px]"
          >
            <option value="">Todos</option>
            {opcoes?.status.map((status) => (
              <option key={status} value={status}>
                {LABEL_STATUS[status]}
              </option>
            ))}
          </Select>
        </FiltroCampo>

        <FiltroCampo label="De">
          <input
            type="datetime-local"
            value={filtros.de ?? ''}
            onChange={(e) => atualizarFiltro('de', e.target.value)}
            className="h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          />
        </FiltroCampo>

        <FiltroCampo label="Até">
          <div className="flex gap-2">
            <input
              type="datetime-local"
              value={filtros.ate ?? ''}
              onChange={(e) => atualizarFiltro('ate', e.target.value)}
              className="h-9 w-full min-w-0 rounded-md border border-input bg-card px-3 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
            <Button type="button" variant="outline" size="sm" onClick={() => setFiltros({ pagina: 1 })}>
              Limpar
            </Button>
          </div>
        </FiltroCampo>
      </section>

      {erro && <p className="text-sm text-destructive">{erro}</p>}

      <AlarmesTabela
        resultado={resultado}
        totalPaginas={totalPaginas}
        onPaginaAnterior={() => resultado && irParaPagina(resultado.pagina - 1)}
        onProximaPagina={() => resultado && irParaPagina(resultado.pagina + 1)}
        onAlterarStatus={operador ? alterarStatus : undefined}
        alarmeAtualizando={alarmeAtualizando}
      />

      <div>
        <h2 className="font-display text-lg font-semibold">Alertas Configurados</h2>
        <p className="text-sm text-muted-foreground">
          Regras de alerta cadastradas: parâmetro monitorado, limiar, severidade e status.
        </p>
      </div>

      <section
        className="rise grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4"
        aria-label="Filtros de alertas configurados"
      >
        <FiltroCampo label="Estação">
          <Select
            value={filtrosAlertas.estacaoId ?? ''}
            onChange={(e) => atualizarFiltroAlertas('estacaoId', e.target.value)}
            className="font-mono text-[11px]"
          >
            <option value="">Todas</option>
            {opcoesAlertas?.estacoes.map((estacao) => (
              <option key={estacao.id} value={estacao.id}>
                {estacao.nome}
              </option>
            ))}
          </Select>
        </FiltroCampo>

        <FiltroCampo label="Parâmetro">
          <Select
            value={filtrosAlertas.tipoParametroId ?? ''}
            onChange={(e) => atualizarFiltroAlertas('tipoParametroId', e.target.value)}
            className="font-mono text-[11px]"
          >
            <option value="">Todos</option>
            {opcoesAlertas?.tiposParametro.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nome}
              </option>
            ))}
          </Select>
        </FiltroCampo>

        <FiltroCampo label="Severidade">
          <Select
            value={filtrosAlertas.severidade ?? ''}
            onChange={(e) => atualizarFiltroAlertas('severidade', e.target.value as SeveridadeAlerta)}
            className="font-mono text-[11px]"
          >
            <option value="">Todas</option>
            {opcoesAlertas?.severidades.map((severidade) => (
              <option key={severidade} value={severidade}>
                {LABEL_SEVERIDADE[severidade]}
              </option>
            ))}
          </Select>
        </FiltroCampo>

        <FiltroCampo label="Status">
          <Select
            value={filtrosAlertas.ativo === undefined ? '' : String(filtrosAlertas.ativo)}
            onChange={(e) =>
              atualizarFiltroAlertas('ativo', e.target.value === '' ? undefined : e.target.value === 'true')
            }
            className="font-mono text-[11px]"
          >
            <option value="">Todos</option>
            <option value="true">Ativo</option>
            <option value="false">Inativo</option>
          </Select>
        </FiltroCampo>
      </section>

      {erroAlertas && <p className="text-sm text-destructive">{erroAlertas}</p>}

      <AlertasTabela
        resultado={resultadoAlertas}
        totalPaginas={totalPaginasAlertas}
        onPaginaAnterior={() => resultadoAlertas && irParaPaginaAlertas(resultadoAlertas.pagina - 1)}
        onProximaPagina={() => resultadoAlertas && irParaPaginaAlertas(resultadoAlertas.pagina + 1)}
      />
    </div>
  );
}

function AlarmesTabela({
  resultado,
  totalPaginas,
  onPaginaAnterior,
  onProximaPagina,
  onAlterarStatus,
  alarmeAtualizando,
}: {
  resultado: ListaAlarmes | null;
  totalPaginas: number;
  onPaginaAnterior: () => void;
  onProximaPagina: () => void;
  /** Ausente para quem só lê: a tabela não mostra as ações. */
  onAlterarStatus?: (alarme: AlarmeHistorico, status: StatusAlarme) => void;
  alarmeAtualizando: string | null;
}) {
  const itens = resultado?.itens ?? [];
  const abertos = itens.filter((item) => item.status === 'ABERTO').length;
  const colunas = onAlterarStatus
    ? 'sm:grid-cols-[1.1fr_1.2fr_1fr_.8fr_.8fr_minmax(11rem,auto)]'
    : 'sm:grid-cols-[1.1fr_1.2fr_1fr_.8fr_.8fr]';

  return (
    <article className="rise delay-2 overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold">Ocorrências</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            {resultado ? `${resultado.total} registro(s) · ${abertos} em aberto nesta página` : 'Carregando...'}
          </p>
        </div>
      </div>

      {!resultado ? (
        <div className="grid min-h-64 place-items-center px-6 text-center">
          <p className="text-sm text-muted-foreground">Carregando ocorrências...</p>
        </div>
      ) : itens.length === 0 ? (
        <div className="grid min-h-64 place-items-center px-6 text-center">
          <div>
            <ShieldCheck className="mx-auto mb-3 size-8 text-aqua" />
            <p className="font-display text-sm font-semibold">Nenhuma ocorrência encontrada</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros selecionados.</p>
          </div>
        </div>
      ) : (
        // No celular cada linha vira um cartão; a partir do sm, com as ações, a tabela rola na horizontal.
        <div className="sm:overflow-x-auto">
          <div className={cn(onAlterarStatus && 'sm:min-w-[52rem]')}>
            <div
              className={cn(
                'hidden gap-3 border-b border-border px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground sm:grid',
                colunas,
              )}
            >
              <span>Data/Hora</span>
              <span>Estação</span>
              <span>Parâmetro</span>
              <span>Severidade</span>
              <span>Status</span>
              {onAlterarStatus && <span>Ações</span>}
            </div>

            {itens.map((alarme) => (
              <div
                key={alarme.id}
                className={cn(
                  'grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border px-4 py-3 last:border-0 sm:items-center',
                  colunas,
                )}
              >
                <span className="font-mono text-[11px] text-muted-foreground">
                  {new Date(alarme.disparadoEm).toLocaleString('pt-BR')}
                </span>
                <span className="truncate text-[13px] font-semibold sm:font-normal">{alarme.estacao.nome}</span>
                <span className="text-[12px] text-muted-foreground">
                  {alarme.parametro.nome} ({alarme.valorMedido}
                  {alarme.parametro.unidade})
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-semibold">
                  <span className={cn('size-1.5 rounded-full', COR_SEVERIDADE[alarme.severidade])} />
                  {LABEL_SEVERIDADE[alarme.severidade].toLowerCase()}
                </span>
                <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-semibold">
                  <span className={cn('size-1.5 rounded-full', COR_STATUS[alarme.status])} />
                  {LABEL_STATUS[alarme.status].toLowerCase()}
                </span>
                {onAlterarStatus && (
                  <span className="col-span-2 flex flex-wrap gap-1.5 sm:col-span-1">
                    {PROXIMOS_STATUS[alarme.status].length === 0 ? (
                      <span className="font-mono text-[10px] text-muted-foreground">—</span>
                    ) : (
                      PROXIMOS_STATUS[alarme.status].map((proximo) => (
                        <Button
                          key={proximo.status}
                          type="button"
                          variant="outline"
                          size="sm"
                          disabled={alarmeAtualizando === alarme.id}
                          onClick={() => onAlterarStatus(alarme, proximo.status)}
                          aria-label={`${proximo.rotulo} alarme de ${alarme.estacao.nome}`}
                        >
                          {proximo.rotulo}
                        </Button>
                      ))
                    )}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {resultado && resultado.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            Página {resultado.pagina} de {totalPaginas} · {resultado.total} ocorrência(s)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={resultado.pagina <= 1}
              onClick={onPaginaAnterior}
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={resultado.pagina >= totalPaginas}
              onClick={onProximaPagina}
              aria-label="Próxima página"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}

function AlertasTabela({
  resultado,
  totalPaginas,
  onPaginaAnterior,
  onProximaPagina,
}: {
  resultado: ListaAlertas | null;
  totalPaginas: number;
  onPaginaAnterior: () => void;
  onProximaPagina: () => void;
}) {
  const itens = resultado?.itens ?? [];

  const LABEL_OPERADOR: Record<string, string> = {
    MAIOR_QUE: '>',
    MENOR_QUE: '<',
    IGUAL_A: '=',
    MAIOR_OU_IGUAL: '>=',
    MENOR_OU_IGUAL: '<=',
  };

  return (
    <article className="rise overflow-hidden rounded-lg border border-border bg-card">
      <div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 border-b border-border px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-display text-sm font-semibold">Regras</h2>
          <p className="font-mono text-[10px] text-muted-foreground">
            {resultado ? `${resultado.total} alerta(s) configurado(s)` : 'Carregando...'}
          </p>
        </div>
      </div>

      <div className="hidden grid-cols-[1.1fr_1.2fr_1fr_.8fr_.8fr] gap-3 border-b border-border px-4 py-2 font-mono text-[10px] uppercase text-muted-foreground sm:grid">
        <span>Estação</span>
        <span>Parâmetro</span>
        <span>Limiar</span>
        <span>Severidade</span>
        <span>Status</span>
      </div>

      {!resultado ? (
        <div className="grid min-h-40 place-items-center px-6 text-center">
          <p className="text-sm text-muted-foreground">Carregando alertas...</p>
        </div>
      ) : itens.length === 0 ? (
        <div className="grid min-h-40 place-items-center px-6 text-center">
          <div>
            <ShieldCheck className="mx-auto mb-3 size-8 text-aqua" />
            <p className="font-display text-sm font-semibold">Nenhum alerta encontrado</p>
            <p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros selecionados.</p>
          </div>
        </div>
      ) : (
        itens.map((alerta) => (
          <div
            key={alerta.id}
            className="grid grid-cols-[minmax(0,1fr)_auto] gap-2 border-b border-border px-4 py-3 last:border-0 sm:grid-cols-[1.1fr_1.2fr_1fr_.8fr_.8fr] sm:items-center"
          >
            <span className="truncate text-[13px] font-semibold sm:font-normal">{alerta.estacao.nome}</span>
            <span className="text-[12px] text-muted-foreground">{alerta.parametro.nome}</span>
            <span className="font-mono text-[12px] text-muted-foreground">
              {LABEL_OPERADOR[alerta.operador] ?? alerta.operador} {alerta.valorLimite}
              {alerta.parametro.unidade}
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-semibold">
              <span className={cn('size-1.5 rounded-full', COR_SEVERIDADE[alerta.severidade])} />
              {LABEL_SEVERIDADE[alerta.severidade].toLowerCase()}
            </span>
            <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-semibold">
              <span className={cn('size-1.5 rounded-full', alerta.ativo ? 'bg-lime' : 'bg-muted-foreground')} />
              {alerta.ativo ? 'ativo' : 'inativo'}
            </span>
          </div>
        ))
      )}

      {resultado && resultado.total > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border px-4 py-3">
          <span className="font-mono text-[10px] text-muted-foreground">
            Página {resultado.pagina} de {totalPaginas} · {resultado.total} alerta(s)
          </span>
          <div className="flex gap-1">
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={resultado.pagina <= 1}
              onClick={onPaginaAnterior}
              aria-label="Página anterior"
            >
              <ChevronLeft />
            </Button>
            <Button
              variant="outline"
              size="icon"
              className="size-7"
              disabled={resultado.pagina >= totalPaginas}
              onClick={onProximaPagina}
              aria-label="Próxima página"
            >
              <ChevronRight />
            </Button>
          </div>
        </div>
      )}
    </article>
  );
}
