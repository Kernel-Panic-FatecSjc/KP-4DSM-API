'use client';

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock3, Gauge, Hash, MapPin, Radio, ShieldCheck, UserRound } from 'lucide-react';
import { useCallback, useEffect, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { api, ErroApi, type AlarmeHistorico, type FiltrosAlarmes, type ListaAlarmes, type OpcoesFiltroAlarmes, type SeveridadeAlerta, type StatusAlarme } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { cn } from '@/lib/utils';

const LABEL_SEVERIDADE: Record<SeveridadeAlerta, string> = { ATENCAO: 'Atenção', ALERTA: 'Alerta', EMERGENCIA: 'Emergência' };
const COR_SEVERIDADE: Record<SeveridadeAlerta, string> = { ATENCAO: 'bg-aqua', ALERTA: 'bg-warning', EMERGENCIA: 'bg-critical' };
const LABEL_STATUS: Record<StatusAlarme, string> = { ABERTO: 'Aberto', RECONHECIDO: 'Reconhecido', RESOLVIDO: 'Resolvido' };
const COR_STATUS: Record<StatusAlarme, string> = { ABERTO: 'bg-critical', RECONHECIDO: 'bg-aqua', RESOLVIDO: 'bg-lime' };
const LABEL_OPERADOR: Record<string, string> = { MAIOR_QUE: 'Maior que', MENOR_QUE: 'Menor que', IGUAL_A: 'Igual a', DIFERENTE_DE: 'Diferente de', MAIOR_OU_IGUAL: 'Maior ou igual a', MENOR_OU_IGUAL: 'Menor ou igual a' };

function montarQuery(filtros: FiltrosAlarmes): string {
  const parametros = new URLSearchParams();
  if (filtros.estacaoId) parametros.set('estacaoId', filtros.estacaoId);
  if (filtros.tipoParametroId) parametros.set('tipoParametroId', filtros.tipoParametroId);
  if (filtros.severidade) parametros.set('severidade', filtros.severidade);
  if (filtros.status) parametros.set('status', filtros.status);
  if (filtros.de) parametros.set('de', new Date(filtros.de).toISOString());
  if (filtros.ate) parametros.set('ate', new Date(filtros.ate).toISOString());
  parametros.set('pagina', String(filtros.pagina ?? 1));
  parametros.set('tamanho', '20');
  return parametros.toString();
}

function formatarData(data: string) { return new Date(data).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }); }
function formatarNumero(valor: number) { return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 3 }).format(valor); }

function FiltroCampo({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex flex-col gap-1"><label className="font-mono text-[10px] uppercase text-muted-foreground">{label}</label>{children}</div>;
}

function InfoItem({ icon: Icon, label, value, mono = false }: { icon: typeof MapPin; label: string; value: string; mono?: boolean }) {
  return <div className="flex gap-2.5 border-b border-border py-3 last:border-0"><Icon className="mt-0.5 size-4 shrink-0 text-muted-foreground" /><div className="min-w-0"><div className="text-xs text-muted-foreground">{label}</div><div className={cn('mt-0.5 break-words text-sm text-foreground', mono && 'font-mono text-[12px]')}>{value}</div></div></div>;
}

export default function AlertaLogPage() {
  const router = useRouter();
  const [opcoes, setOpcoes] = useState<OpcoesFiltroAlarmes | null>(null);
  const [resultado, setResultado] = useState<ListaAlarmes | null>(null);
  const [selecionadaId, setSelecionadaId] = useState<string | null>(null);
  const [filtros, setFiltros] = useState<FiltrosAlarmes>({ pagina: 1 });
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (filtrosAtuais: FiltrosAlarmes) => {
    setErro(null);
    try {
      const dados = await api<ListaAlarmes>(`/alarmes?${montarQuery(filtrosAtuais)}`);
      setResultado(dados);
      setSelecionadaId((atual) => dados.itens.some((item) => item.id === atual) ? atual : dados.itens[0]?.id ?? null);
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) { router.push('/login'); return; }
      setResultado(null);
      setSelecionadaId(null);
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao carregar ocorrências.');
    }
  }, [router]);

  useEffect(() => {
    api<OpcoesFiltroAlarmes>('/alarmes/filtros').then(setOpcoes).catch((erroCapturado) => {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) router.push('/login');
    });
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega a lista quando os filtros mudam
    void carregar(filtros);
  }, [carregar, filtros]);

  function atualizarFiltro<K extends keyof FiltrosAlarmes>(campo: K, valor: FiltrosAlarmes[K]) {
    setFiltros((atual) => ({ ...atual, [campo]: valor || undefined, pagina: 1 }));
  }

  const ocorrencia: AlarmeHistorico | null = resultado?.itens.find((item) => item.id === selecionadaId) ?? resultado?.itens[0] ?? null;
  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.tamanho)) : 1;

  return <div className="space-y-5">
    <PageHeading title="Detalhamento de ocorrência" description="Consulte ocorrências disparadas e selecione um registro para visualizar todos os dados do evento." />
    <section className="rise delay-1 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6" aria-label="Filtros de ocorrências">
      <FiltroCampo label="Estação"><Select value={filtros.estacaoId ?? ''} onChange={(e) => atualizarFiltro('estacaoId', e.target.value)}><option value="">Todas</option>{opcoes?.estacoes.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</Select></FiltroCampo>
      <FiltroCampo label="Parâmetro"><Select value={filtros.tipoParametroId ?? ''} onChange={(e) => atualizarFiltro('tipoParametroId', e.target.value)}><option value="">Todos</option>{opcoes?.tiposParametro.map((item) => <option key={item.id} value={item.id}>{item.nome}</option>)}</Select></FiltroCampo>
      <FiltroCampo label="Severidade"><Select value={filtros.severidade ?? ''} onChange={(e) => atualizarFiltro('severidade', e.target.value as SeveridadeAlerta)}><option value="">Todas</option>{opcoes?.severidades.map((item) => <option key={item} value={item}>{LABEL_SEVERIDADE[item]}</option>)}</Select></FiltroCampo>
      <FiltroCampo label="Status"><Select value={filtros.status ?? ''} onChange={(e) => atualizarFiltro('status', e.target.value as StatusAlarme)}><option value="">Todos</option>{opcoes?.status.map((item) => <option key={item} value={item}>{LABEL_STATUS[item]}</option>)}</Select></FiltroCampo>
      <FiltroCampo label="De"><input type="datetime-local" value={filtros.de ?? ''} onChange={(e) => atualizarFiltro('de', e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /></FiltroCampo>
      <FiltroCampo label="Até"><div className="flex gap-2"><input type="datetime-local" value={filtros.ate ?? ''} onChange={(e) => atualizarFiltro('ate', e.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" /><Button type="button" variant="outline" size="sm" onClick={() => setFiltros({ pagina: 1 })}>Limpar</Button></div></FiltroCampo>
    </section>
    {erro && <p className="text-sm text-destructive">{erro}</p>}
    <section className="rise delay-2 grid gap-5 lg:grid-cols-[minmax(280px,0.8fr)_minmax(0,1.5fr)]" aria-label="Ocorrências e detalhe selecionado">
      <article className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="border-b border-border px-4 py-3"><h2 className="font-display text-sm font-semibold">Ocorrências disparadas</h2><p className="font-mono text-[10px] text-muted-foreground">{resultado ? `${resultado.total} registro(s)` : 'Carregando...'}</p></div>
        {!resultado ? <div className="grid min-h-52 place-items-center px-6 text-center text-sm text-muted-foreground">Carregando ocorrências...</div> : resultado.itens.length === 0 ? <div className="grid min-h-52 place-items-center px-6 text-center"><div><ShieldCheck className="mx-auto mb-3 size-8 text-aqua" /><p className="font-display text-sm font-semibold">Nenhuma ocorrência encontrada</p><p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros selecionados.</p></div></div> : <div>{resultado.itens.map((item) => <button key={item.id} type="button" onClick={() => setSelecionadaId(item.id)} className={cn('flex w-full border-b border-border text-left transition-colors last:border-0 hover:bg-muted/40', item.id === ocorrencia?.id && 'bg-muted/60')}><span className={cn('w-1 shrink-0', COR_SEVERIDADE[item.severidade])} /><span className="min-w-0 flex-1 px-3.5 py-3"><span className="block truncate text-sm font-semibold">{item.estacao.nome}</span><span className="mt-0.5 block text-xs text-muted-foreground">{item.parametro.nome} · {formatarNumero(item.valorMedido)} {item.parametro.unidade}</span><span className="mt-2 flex items-center justify-between gap-2 font-mono text-[10px] text-muted-foreground"><span>{formatarData(item.disparadoEm)}</span><span className="inline-flex items-center gap-1"><span className={cn('size-1.5 rounded-full', COR_STATUS[item.status])} />{LABEL_STATUS[item.status]}</span></span></span></button>)}</div>}
        {resultado && resultado.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><span className="font-mono text-[10px] text-muted-foreground">Página {resultado.pagina} de {totalPaginas}</span><div className="flex gap-1"><Button variant="outline" size="icon" className="size-7" disabled={resultado.pagina <= 1} onClick={() => setFiltros((atual) => ({ ...atual, pagina: resultado.pagina - 1 }))} aria-label="Página anterior"><ChevronLeft /></Button><Button variant="outline" size="icon" className="size-7" disabled={resultado.pagina >= totalPaginas} onClick={() => setFiltros((atual) => ({ ...atual, pagina: resultado.pagina + 1 }))} aria-label="Próxima página"><ChevronRight /></Button></div></div>}
      </article>
      <article className="rounded-lg border border-border bg-card p-5 sm:p-6">{!ocorrencia ? <div className="grid min-h-64 place-items-center text-center text-sm text-muted-foreground">Selecione uma ocorrência para ver os detalhes.</div> : <DetalheOcorrencia ocorrencia={ocorrencia} />}</article>
    </section>
  </div>;
}

function DetalheOcorrencia({ ocorrencia }: { ocorrencia: AlarmeHistorico }) {
  const operador = LABEL_OPERADOR[ocorrencia.operador] ?? ocorrencia.operador;
  const percentual = ocorrencia.valorLimite === 0 ? 100 : Math.min((ocorrencia.valorMedido / ocorrencia.valorLimite) * 100, 100);
  return <div className="space-y-6"><div className="flex flex-wrap items-start justify-between gap-3 border-b border-border pb-5"><div><div className="font-mono text-xs text-muted-foreground">{ocorrencia.id}</div><h2 className="mt-1 text-xl font-semibold">{ocorrencia.estacao.nome}</h2><div className="mt-2 flex items-center gap-1.5 text-xs text-muted-foreground"><Clock3 className="size-4" /><span className="font-mono">{formatarData(ocorrencia.disparadoEm)}</span></div></div><div className="flex flex-wrap gap-2"><span className="inline-flex items-center gap-1.5 rounded bg-warning/10 px-3 py-1.5 text-xs font-medium text-warning"><AlertTriangle className="size-4" />{LABEL_SEVERIDADE[ocorrencia.severidade]}</span><span className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-3 py-1.5 text-xs font-medium"><CheckCircle2 className={cn('size-4', ocorrencia.status === 'ABERTO' && 'text-critical', ocorrencia.status === 'RECONHECIDO' && 'text-aqua', ocorrencia.status === 'RESOLVIDO' && 'text-lime')} />{LABEL_STATUS[ocorrencia.status]}</span></div></div><div className="rounded-lg border border-border bg-muted p-4"><div className="flex items-center gap-2 text-xs text-muted-foreground"><Gauge className="size-4 text-aqua" />Parâmetro que violou o limiar</div><div className="mt-1 text-base font-semibold">{ocorrencia.parametro.nome}</div><div className="mt-4 grid gap-4 sm:grid-cols-2"><div><div className="text-xs text-muted-foreground">Valor registrado</div><div className="mt-1 font-mono text-2xl font-semibold text-critical">{formatarNumero(ocorrencia.valorMedido)} <span className="text-sm text-muted-foreground">{ocorrencia.parametro.unidade}</span></div></div><div><div className="text-xs text-muted-foreground">Limiar configurado</div><div className="mt-1 font-mono text-2xl font-semibold">{formatarNumero(ocorrencia.valorLimite)} <span className="text-sm text-muted-foreground">{ocorrencia.parametro.unidade}</span></div></div></div><div className="mt-4 h-2 overflow-hidden rounded-full bg-border"><div className="h-full rounded-full bg-critical transition-all" style={{ width: `${percentual}%` }} /></div><div className="mt-1.5 flex justify-between text-xs text-muted-foreground"><span>0</span><span>Valor medido / limiar</span></div></div><div className="grid gap-x-6 sm:grid-cols-2"><InfoItem icon={MapPin} label="Estação afetada" value={ocorrencia.estacao.nome} /><InfoItem icon={Radio} label="Unidade do parâmetro" value={ocorrencia.parametro.unidade} mono /><InfoItem icon={Hash} label="ID do parâmetro" value={ocorrencia.parametro.id} mono /><InfoItem icon={UserRound} label="Regra aplicada" value={`${operador} ${formatarNumero(ocorrencia.valorLimite)} ${ocorrencia.parametro.unidade}`} /></div></div>;
}
