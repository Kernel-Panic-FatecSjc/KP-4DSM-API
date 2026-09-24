'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clock3, Database, FileSearch, Filter, Hash, RefreshCw, ShieldCheck, UserRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ErroApi, type ListaAuditoria, type RegistroAuditoria } from '@/lib/api';
import { cn } from '@/lib/utils';

const TAMANHO_PAGINA = 25;
const FILTROS_INICIAIS = { acao: '', entidade: '', entidadeId: '', usuarioId: '', de: '', ate: '', pagina: 1 };

function formatarDataHora(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(data);
}

function formatarDetalhes(valor: unknown): string {
  if (valor === null || valor === undefined) return 'Nenhum detalhe informado';
  if (typeof valor === 'string') return valor;
  return JSON.stringify(valor, null, 2);
}

function nomeAcao(acao: string): string {
  const [modulo, operacao] = acao.split('.');
  if (!operacao) return acao;
  return `${modulo} · ${operacao.replaceAll('_', ' ')}`;
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return <div className="flex min-w-0 flex-col gap-1"><label className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</label>{children}</div>;
}

function Indicador({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: string }) {
  return <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span><Icon className={cn('size-4', tone)} /></div><p className="mt-2 font-display text-2xl font-semibold">{value}</p></article>;
}

export default function AuditoriaPage() {
  const router = useRouter();
  const [lista, setLista] = useState<ListaAuditoria | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);

  const carregar = useCallback(async (filtrosAtuais: typeof FILTROS_INICIAIS, pagina = filtrosAtuais.pagina) => {
    setCarregando(true);
    setErro(null);
    const parametros = new URLSearchParams({ tamanho: String(TAMANHO_PAGINA), pagina: String(pagina) });
    if (filtrosAtuais.acao.trim()) parametros.set('acao', filtrosAtuais.acao.trim());
    if (filtrosAtuais.entidade.trim()) parametros.set('entidade', filtrosAtuais.entidade.trim());
    if (filtrosAtuais.entidadeId.trim()) parametros.set('entidadeId', filtrosAtuais.entidadeId.trim());
    if (filtrosAtuais.usuarioId.trim()) parametros.set('usuarioId', filtrosAtuais.usuarioId.trim());
    if (filtrosAtuais.de) parametros.set('de', new Date(`${filtrosAtuais.de}T00:00:00`).toISOString());
    if (filtrosAtuais.ate) parametros.set('ate', new Date(`${filtrosAtuais.ate}T23:59:59.999`).toISOString());

    try {
      const dados = await api<ListaAuditoria>(`/auditoria?${parametros.toString()}`);
      setLista(dados);
      setSelecionadoId((atual) => dados.itens.some((item) => item.id === atual) ? atual : dados.itens[0]?.id ?? null);
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && (erroCapturado.status === 401 || erroCapturado.status === 403)) {
        router.replace(erroCapturado.status === 401 ? '/login?proximo=/auditoria' : '/dashboard');
        return;
      }
      setLista(null);
      setSelecionadoId(null);
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Erro ao carregar auditoria.');
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta protegida ao montar a página
    void carregar(FILTROS_INICIAIS, 1);
  }, [carregar]);

  function consultar(evento?: React.FormEvent<HTMLFormElement>) {
    evento?.preventDefault();
    const consulta = { ...filtros, pagina: 1 };
    setFiltros(consulta);
    void carregar(consulta, 1);
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    void carregar(FILTROS_INICIAIS, 1);
  }

  const selecionado: RegistroAuditoria | null = lista?.itens.find((item) => item.id === selecionadoId) ?? null;
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.tamanho)) : 1;
  const acoesNaPagina = useMemo(() => new Set(lista?.itens.map((item) => item.acao)).size, [lista]);
  const usuariosNaPagina = useMemo(() => new Set(lista?.itens.map((item) => item.usuario?.id).filter(Boolean)).size, [lista]);

  return <div className="space-y-5">
    <PageHeading title="Auditoria" description="Rastreabilidade das ações realizadas no sistema, disponível somente para administradores." action={<span className="hidden items-center gap-2 rounded-md border border-lime/30 bg-lime/10 px-3 py-2 text-xs font-semibold text-lime sm:inline-flex"><ShieldCheck className="size-4" />Acesso restrito</span>} />

    <section className="rise delay-1 grid gap-3 sm:grid-cols-3">
      <Indicador icon={ClipboardList} label="Registros encontrados" value={lista ? String(lista.total) : '—'} tone="text-aqua" />
      <Indicador icon={Activity} label="Ações nesta página" value={lista ? String(acoesNaPagina) : '—'} tone="text-warning" />
      <Indicador icon={UserRound} label="Usuários nesta página" value={lista ? String(usuariosNaPagina) : '—'} tone="text-lime" />
    </section>

    <form onSubmit={consultar} className="rise delay-2 rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3"><div><div className="flex items-center gap-2"><Filter className="size-4 text-aqua" /><h2 className="font-display text-sm font-semibold">Filtros de consulta</h2></div><p className="mt-1 text-xs text-muted-foreground">Refine os registros por ação, recurso, usuário ou período.</p></div><Button type="button" variant="ghost" size="sm" onClick={limparFiltros}><X />Limpar filtros</Button></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Filtro label="Ação"><Input placeholder="ex.: usuarios.criar" value={filtros.acao} onChange={(e) => setFiltros((atual) => ({ ...atual, acao: e.target.value }))} /></Filtro>
        <Filtro label="Recurso"><Input placeholder="ex.: Usuario" value={filtros.entidade} onChange={(e) => setFiltros((atual) => ({ ...atual, entidade: e.target.value }))} /></Filtro>
        <Filtro label="ID do recurso"><Input placeholder="UUID do recurso" value={filtros.entidadeId} onChange={(e) => setFiltros((atual) => ({ ...atual, entidadeId: e.target.value }))} /></Filtro>
        <Filtro label="ID do usuário"><Input placeholder="UUID do usuário" value={filtros.usuarioId} onChange={(e) => setFiltros((atual) => ({ ...atual, usuarioId: e.target.value }))} /></Filtro>
        <Filtro label="Data inicial"><Input type="date" value={filtros.de} onChange={(e) => setFiltros((atual) => ({ ...atual, de: e.target.value }))} /></Filtro>
        <Filtro label="Data final"><Input type="date" value={filtros.ate} onChange={(e) => setFiltros((atual) => ({ ...atual, ate: e.target.value }))} /></Filtro>
        <div className="flex items-end sm:col-span-2"><Button type="submit" className="w-full sm:w-auto" disabled={carregando}><FileSearch />{carregando ? 'Consultando...' : 'Consultar registros'}</Button></div>
      </div>
    </form>

    {erro && <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{erro}</span><Button type="button" variant="outline" size="sm" onClick={() => void carregar(filtros)}>Tentar novamente</Button></div>}

    <section className="rise delay-3 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]" aria-label="Registros de auditoria">
      <article className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Database className="size-4 text-aqua" /><div><h2 className="font-display text-sm font-semibold">Linha do tempo de atividades</h2><p className="font-mono text-[10px] text-muted-foreground">{lista ? `${lista.total} registro(s) · página ${lista.pagina} de ${totalPaginas}` : 'Carregando registros...'}</p></div></div>{carregando && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}</div>
        {carregando && !lista ? <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">Carregando auditoria...</div> : lista?.itens.length ? <div className="overflow-x-auto"><table className="w-full min-w-[780px] text-left text-sm"><thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Data/hora</th><th className="px-4 py-3 font-medium">Usuário</th><th className="px-4 py-3 font-medium">Ação</th><th className="px-4 py-3 font-medium">Recurso</th><th className="px-4 py-3 font-medium">Detalhes</th></tr></thead><tbody>{lista.itens.map((registro) => <tr key={registro.id} onClick={() => setSelecionadoId(registro.id)} className={cn('cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40', registro.id === selecionadoId && 'bg-muted/60')}><td className="whitespace-nowrap px-4 py-3 align-top"><div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"><Clock3 className="size-3.5 text-aqua" />{formatarDataHora(registro.criadoEm)}</div></td><td className="px-4 py-3 align-top"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-aqua/10 text-aqua"><UserRound className="size-3.5" /></span><div><p className="max-w-32 truncate font-medium">{registro.usuario?.nome ?? 'Sistema'}</p>{registro.usuario && <p className="font-mono text-[10px] text-muted-foreground">{registro.usuario.id.slice(0, 8)}...</p>}</div></div></td><td className="px-4 py-3 align-top"><span className="inline-flex rounded border border-aqua/30 bg-aqua/10 px-2 py-1 font-mono text-[11px] font-medium text-aqua">{nomeAcao(registro.acao)}</span></td><td className="px-4 py-3 align-top"><p className="font-medium">{registro.entidade}</p>{registro.entidadeId && <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Hash className="size-3" />{registro.entidadeId.slice(0, 12)}...</p>}</td><td className="max-w-64 px-4 py-3 align-top"><p className="line-clamp-2 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{formatarDetalhes(registro.detalhes)}</p></td></tr>)}</tbody></table></div> : <div className="grid min-h-64 place-items-center px-6 text-center"><div><ShieldCheck className="mx-auto mb-3 size-8 text-aqua" /><p className="font-display text-sm font-semibold">Nenhum registro encontrado</p><p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros e faça uma nova consulta.</p></div></div>}
        {lista && lista.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><span className="font-mono text-[10px] text-muted-foreground">Página {lista.pagina} de {totalPaginas}</span><div className="flex gap-1"><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina <= 1 || carregando} onClick={() => { const consulta = { ...filtros, pagina: lista.pagina - 1 }; setFiltros(consulta); void carregar(consulta, lista.pagina - 1); }} aria-label="Página anterior"><ChevronLeft /></Button><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina >= totalPaginas || carregando} onClick={() => { const consulta = { ...filtros, pagina: lista.pagina + 1 }; setFiltros(consulta); void carregar(consulta, lista.pagina + 1); }} aria-label="Próxima página"><ChevronRight /></Button></div></div>}
      </article>

      <DetalheAuditoria registro={selecionado} />
    </section>
  </div>;
}

function DetalheAuditoria({ registro }: { registro: RegistroAuditoria | null }) {
  return <aside className="h-fit rounded-lg border border-border bg-card"><div className="border-b border-border px-4 py-3"><div className="flex items-center gap-2"><FileSearch className="size-4 text-warning" /><div><h2 className="font-display text-sm font-semibold">Detalhes do registro</h2><p className="font-mono text-[10px] text-muted-foreground">Selecione uma linha para inspecionar</p></div></div></div>{!registro ? <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">Nenhum registro selecionado.</div> : <div className="space-y-4 p-4"><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1"><div><span className="font-mono text-[10px] uppercase text-muted-foreground">Data e hora</span><p className="mt-1 flex items-center gap-2 text-sm"><CalendarDays className="size-4 text-aqua" />{formatarDataHora(registro.criadoEm)}</p></div><div><span className="font-mono text-[10px] uppercase text-muted-foreground">Usuário responsável</span><p className="mt-1 flex items-center gap-2 text-sm"><UserRound className="size-4 text-aqua" />{registro.usuario?.nome ?? 'Sistema'}</p>{registro.usuario && <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{registro.usuario.id}</p>}</div><div><span className="font-mono text-[10px] uppercase text-muted-foreground">Ação executada</span><p className="mt-1 font-mono text-sm text-aqua">{registro.acao}</p></div><div><span className="font-mono text-[10px] uppercase text-muted-foreground">Recurso afetado</span><p className="mt-1 text-sm">{registro.entidade}</p>{registro.entidadeId && <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{registro.entidadeId}</p>}</div></div><div className="border-t border-border pt-4"><span className="font-mono text-[10px] uppercase text-muted-foreground">Detalhes relevantes</span><pre className="mt-2 max-h-72 overflow-auto rounded-md border border-border bg-muted p-3 font-mono text-[11px] leading-relaxed text-foreground">{formatarDetalhes(registro.detalhes)}</pre></div><div className="border-t border-border pt-3"><span className="font-mono text-[10px] text-muted-foreground">ID do registro</span><p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{registro.id}</p></div></div>}</aside>;
}
