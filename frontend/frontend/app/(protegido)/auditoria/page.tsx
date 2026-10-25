'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Activity, CalendarDays, ChevronLeft, ChevronRight, ClipboardList, Clock3, Database, Download, FileSearch, FileSpreadsheet, Filter, Hash, RefreshCw, ShieldCheck, UserRound, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { baixarPlanilha } from '@/lib/baixar-planilha';
import { api, baixarDaApi, ErroApi, type ListaAuditoria, type RegistroAuditoria } from '@/lib/api';
import { ehTecsus } from '@/lib/perfil';
import { cn } from '@/lib/utils';
import { useCodigosLicitacao } from '@/lib/licitacoes';

const TAMANHO_PAGINA = 25;
const FILTROS_INICIAIS = { acao: '', entidade: '', entidadeId: '', usuarioId: '', licitacaoId: '', de: '', ate: '', pagina: 1 };
// O Excel formatado é montado no navegador (exceljs), sem streaming: acima
// disso a aba trava. Para volumes maiores existe o CSV gerado pela API.
const LIMITE_PLANILHA = 5000;
const TAMANHO_LOTE_PLANILHA = 200;

function parametrosFiltro(filtros: typeof FILTROS_INICIAIS): URLSearchParams {
  const parametros = new URLSearchParams();
  if (filtros.acao.trim()) parametros.set('acao', filtros.acao.trim());
  if (filtros.entidade.trim()) parametros.set('entidade', filtros.entidade.trim());
  if (filtros.entidadeId.trim()) parametros.set('entidadeId', filtros.entidadeId.trim());
  if (filtros.usuarioId.trim()) parametros.set('usuarioId', filtros.usuarioId.trim());
  if (filtros.licitacaoId) parametros.set('licitacaoId', filtros.licitacaoId);
  if (filtros.de) parametros.set('de', new Date(`${filtros.de}T00:00:00`).toISOString());
  if (filtros.ate) parametros.set('ate', new Date(`${filtros.ate}T23:59:59.999`).toISOString());
  return parametros;
}

function parametrosConsulta(filtros: typeof FILTROS_INICIAIS, pagina: number, tamanho: number): URLSearchParams {
  const parametros = parametrosFiltro(filtros);
  parametros.set('tamanho', String(tamanho));
  parametros.set('pagina', String(pagina));
  return parametros;
}

/** A API recusa exportar sem período (varreria a trilha inteira); aqui o aviso vem antes do clique virar navegação. */
function problemaPeriodoExportacao(filtros: typeof FILTROS_INICIAIS): string | null {
  if (!filtros.de || !filtros.ate) return 'Informe a data inicial e a data final para exportar o CSV.';
  if (filtros.de > filtros.ate) return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}

function detalhesEmTexto(valor: unknown, caminho = ''): string[] {
  if (Array.isArray(valor)) {
    return valor.flatMap((item, indice) => detalhesEmTexto(item, `${caminho ? `${caminho} / ` : ''}Item ${indice + 1}`));
  }

  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([chave, conteudo]) => {
      if (chave === 'IP de origem (mascarado)') return [];
      const nome = caminho ? `${caminho} / ${nomeCampo(chave)}` : nomeCampo(chave);
      return detalhesEmTexto(conteudo, nome);
    });
  }

  return caminho ? [`${caminho}: ${valorLegivel(valor)}`] : [valorLegivel(valor)];
}

function formatarDataHora(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(data);
}

function nomeCampo(chave: string): string {
  if (chave === 'IP de origem (mascarado)') return chave;
  return chave
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replaceAll('_', ' ')
    .replace(/^\w/, (letra) => letra.toUpperCase());
}

function valorLegivel(valor: unknown): string {
  if (valor === null || valor === undefined) return 'Não informado';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);
  if (typeof valor === 'string') return valor;
  return String(valor);
}

function tentarLerObjetoJson(valor: string): unknown {
  try {
    const convertido: unknown = JSON.parse(valor);
    return convertido && typeof convertido === 'object' ? convertido : valor;
  } catch {
    return valor;
  }
}

function DetalhesEstruturados({ valor }: { valor: unknown }) {
  if (Array.isArray(valor)) {
    if (valor.length === 0) return <span className="text-muted-foreground">Nenhum item</span>;
    return <span className="block space-y-1">{valor.map((item, indice) => <span key={indice} className="block border-l border-border pl-3"><span className="text-muted-foreground">Item {indice + 1}: </span><DetalhesEstruturados valor={item} /></span>)}</span>;
  }

  if (typeof valor === 'string') {
    const convertido = tentarLerObjetoJson(valor);
    if (convertido !== valor) return <DetalhesEstruturados valor={convertido} />;
  }

  if (valor && typeof valor === 'object') {
    const campos = Object.entries(valor);
    if (campos.length === 0) return <span className="text-muted-foreground">Sem detalhes</span>;
    return <span className="block space-y-1">{campos.map(([chave, conteudo]) => <span key={chave} className="block"><span className="font-semibold text-aqua">{nomeCampo(chave)}:</span>{conteudo !== null && typeof conteudo === 'object' ? <span className="mt-1 block pl-3"><DetalhesEstruturados valor={conteudo} /></span> : <span className="ml-2 break-all text-foreground">{valorLegivel(conteudo)}</span>}</span>)}</span>;
  }

  return <span className="break-all text-foreground">{valorLegivel(valor)}</span>;
}

function formatarDetalhes(valor: unknown): React.ReactNode {
  if (valor === null || valor === undefined) return 'Nenhum detalhe informado';
  return <DetalhesEstruturados valor={valor} />;
}

function nomeAcao(acao: string): string {
  const [modulo, operacao] = acao.split('.');
  if (!operacao) return acao;
  return `${modulo} · ${operacao.replaceAll('_', ' ')}`;
}

function Filtro({ label, children }: { label: string; children: React.ReactNode }) {
  return <label className="flex min-w-0 flex-col gap-1"><span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span>{children}</label>;
}

function nomeLicitacao(licitacaoId: string | null, codigos: Map<string, string>): string {
  if (!licitacaoId) return 'Tecsus / visitante';
  return codigos.get(licitacaoId) ?? licitacaoId.slice(0, 8);
}

function Indicador({ icon: Icon, label, value, tone }: { icon: typeof Activity; label: string; value: string; tone: string }) {
  return <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between gap-3"><span className="font-mono text-[10px] uppercase tracking-wide text-muted-foreground">{label}</span><Icon className={cn('size-4', tone)} /></div><p className="mt-2 font-display text-2xl font-semibold">{value}</p></article>;
}

export default function AuditoriaPage() {
  const router = useRouter();
  const tecsus = ehTecsus(useUsuario());
  const codigosLicitacao = useCodigosLicitacao(tecsus);
  const [lista, setLista] = useState<ListaAuditoria | null>(null);
  const [selecionadoId, setSelecionadoId] = useState<string | null>(null);
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [aviso, setAviso] = useState<string | null>(null);
  const [exportandoPlanilha, setExportandoPlanilha] = useState(false);
  const [filtros, setFiltros] = useState(FILTROS_INICIAIS);

  const carregar = useCallback(async (filtrosAtuais: typeof FILTROS_INICIAIS, pagina = filtrosAtuais.pagina) => {
    setCarregando(true);
    setErro(null);
    try {
      const parametros = parametrosConsulta(filtrosAtuais, pagina, TAMANHO_PAGINA);
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
    setAviso(null);
    const consulta = { ...filtros, pagina: 1 };
    setFiltros(consulta);
    void carregar(consulta, 1);
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    setAviso(null);
    void carregar(FILTROS_INICIAIS, 1);
  }

  /** Até LIMITE_PLANILHA registros; acima disso devolve null e avisa, sem baixar nada. */
  async function buscarRegistrosDaPlanilha(): Promise<RegistroAuditoria[] | null> {
    const primeiraPagina = await api<ListaAuditoria>(`/auditoria?${parametrosConsulta(filtros, 1, TAMANHO_LOTE_PLANILHA)}`);
    if (primeiraPagina.total > LIMITE_PLANILHA) {
      setAviso(`A consulta tem ${primeiraPagina.total.toLocaleString('pt-BR')} registros e o Excel formatado vai até ${LIMITE_PLANILHA.toLocaleString('pt-BR')}. Reduza o período ou use o CSV, que não tem esse limite.`);
      return null;
    }

    const registros = [...primeiraPagina.itens];
    const totalPaginas = Math.ceil(primeiraPagina.total / TAMANHO_LOTE_PLANILHA);
    for (let pagina = 2; pagina <= totalPaginas; pagina += 1) {
      const proximaPagina = await api<ListaAuditoria>(`/auditoria?${parametrosConsulta(filtros, pagina, TAMANHO_LOTE_PLANILHA)}`);
      registros.push(...proximaPagina.itens);
    }
    return registros.slice(0, LIMITE_PLANILHA);
  }

  function resumoFiltros(): string {
    const ativos = [
      filtros.licitacaoId && `Licitação: ${nomeLicitacao(filtros.licitacaoId, codigosLicitacao)}`,
      filtros.acao.trim() && `Ação: ${filtros.acao.trim()}`,
      filtros.entidade.trim() && `Recurso: ${filtros.entidade.trim()}`,
      filtros.entidadeId.trim() && `ID do recurso: ${filtros.entidadeId.trim()}`,
      filtros.usuarioId.trim() && `ID do usuário: ${filtros.usuarioId.trim()}`,
      filtros.de && `De: ${filtros.de}`,
      filtros.ate && `Até: ${filtros.ate}`,
    ].filter(Boolean);
    return ativos.length ? `Filtros: ${ativos.join(' · ')}` : 'Filtros: nenhum';
  }

  function exportarCsv() {
    setErro(null);
    const problema = problemaPeriodoExportacao(filtros);
    setAviso(problema);
    if (problema) return;
    baixarDaApi(`/auditoria/exportar?${parametrosFiltro(filtros)}`);
  }

  async function exportarPlanilha() {
    setExportandoPlanilha(true);
    setErro(null);
    setAviso(null);
    try {
      const registros = await buscarRegistrosDaPlanilha();
      if (!registros) return;
      const linhas = registros.map((registro) => [
        registro.id,
        new Date(registro.criadoEm),
        registro.usuario?.nome ?? 'Não autenticado',
        registro.usuario?.id ?? '',
        registro.acao,
        registro.entidade,
        registro.entidadeId ?? '',
        registro.enderecoIp ?? 'Não registrado',
        nomeLicitacao(registro.licitacaoId, codigosLicitacao),
        detalhesEmTexto(registro.detalhes).join(' | '),
      ]);

      await baixarPlanilha({
        nomeArquivo: 'auditoria.xlsx',
        nomeAba: 'Auditoria',
        titulo: 'Relatório de auditoria',
        subtitulo: `${resumoFiltros()} · Gerado em ${formatarDataHora(new Date().toISOString())}`,
        cabecalhos: ['ID do registro', 'Data e hora', 'Usuário', 'ID do usuário', 'Ação', 'Recurso afetado', 'ID do recurso', 'IP mascarado', 'Licitação', 'Detalhes do evento'],
        linhas,
        larguras: [40, 22, 26, 40, 22, 30, 40, 24, 20, 64],
        colunasData: [2],
        colunasComQuebra: [10],
      });
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Não foi possível gerar a planilha da auditoria.');
    } finally {
      setExportandoPlanilha(false);
    }
  }

  const selecionado: RegistroAuditoria | null = lista?.itens.find((item) => item.id === selecionadoId) ?? null;
  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.tamanho)) : 1;
  const acoesNaPagina = useMemo(() => new Set(lista?.itens.map((item) => item.acao)).size, [lista]);
  const usuariosNaPagina = useMemo(() => new Set(lista?.itens.map((item) => item.usuario?.id).filter(Boolean)).size, [lista]);

  return <div className="space-y-5">
    <PageHeading title="Auditoria" description={tecsus ? 'Rastreabilidade das ações realizadas no sistema, em todas as licitações. Acesso restrito aos administradores.' : 'Rastreabilidade das ações da sua licitação. Ações da Tecsus e de outras licitações não aparecem aqui.'} action={<span className="hidden items-center gap-2 rounded-md border border-lime/30 bg-lime/10 px-3 py-2 text-xs font-semibold text-lime sm:inline-flex"><ShieldCheck className="size-4" />Acesso restrito</span>} />

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
        {tecsus && <Filtro label="Licitação"><SeletorLicitacao valor={filtros.licitacaoId} onChange={(licitacaoId) => setFiltros((atual) => ({ ...atual, licitacaoId }))} rotuloTodas="Todas as licitações" /></Filtro>}
        <Filtro label="Data inicial"><Input type="date" value={filtros.de} onChange={(e) => setFiltros((atual) => ({ ...atual, de: e.target.value }))} /></Filtro>
        <Filtro label="Data final"><Input type="date" value={filtros.ate} onChange={(e) => setFiltros((atual) => ({ ...atual, ate: e.target.value }))} /></Filtro>
        <div className={cn('flex items-end', tecsus ? 'lg:col-span-1' : 'sm:col-span-2')}><Button type="submit" className="w-full sm:w-auto" disabled={carregando}><FileSearch />{carregando ? 'Consultando...' : 'Consultar registros'}</Button></div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">A exportação usa os filtros acima. O CSV exige data inicial e final; o Excel formatado vai até {LIMITE_PLANILHA.toLocaleString('pt-BR')} registros.</p>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportarCsv} disabled={exportandoPlanilha}><Download />CSV</Button><Button type="button" onClick={() => void exportarPlanilha()} disabled={exportandoPlanilha}><FileSpreadsheet />{exportandoPlanilha ? 'Gerando...' : 'Excel formatado'}</Button></div>
      </div>
    </form>

    {erro && <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"><span>{erro}</span><Button type="button" variant="outline" size="sm" onClick={() => void carregar(filtros)}>Tentar novamente</Button></div>}
    {aviso && <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">{aviso}</div>}

    <section className="rise delay-3 grid gap-5 xl:grid-cols-[minmax(0,1.55fr)_minmax(300px,0.75fr)]" aria-label="Registros de auditoria">
      <article className="overflow-hidden rounded-lg border border-border bg-card">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border px-4 py-3"><div className="flex items-center gap-2"><Database className="size-4 text-aqua" /><div><h2 className="font-display text-sm font-semibold">Linha do tempo de atividades</h2><p className="font-mono text-[10px] text-muted-foreground">{lista ? `${lista.total} registro(s) · página ${lista.pagina} de ${totalPaginas}` : 'Carregando registros...'}</p></div></div>{carregando && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}</div>
        {carregando && !lista ? <div className="grid min-h-64 place-items-center px-6 text-center text-sm text-muted-foreground">Carregando auditoria...</div> : lista?.itens.length ? <div className="overflow-x-auto"><table className={cn('w-full text-left text-sm', tecsus ? 'min-w-[880px]' : 'min-w-[780px]')}><thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase tracking-wide text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Data/hora</th><th className="px-4 py-3 font-medium">Usuário</th><th className="px-4 py-3 font-medium">Ação</th><th className="px-4 py-3 font-medium">Recurso</th>{tecsus && <th className="px-4 py-3 font-medium">Licitação</th>}<th className="px-4 py-3 font-medium">Detalhes</th></tr></thead><tbody>{lista.itens.map((registro) => <tr key={registro.id} onClick={() => setSelecionadoId(registro.id)} className={cn('cursor-pointer border-b border-border transition-colors last:border-0 hover:bg-muted/40', registro.id === selecionadoId && 'bg-muted/60')}><td className="whitespace-nowrap px-4 py-3 align-top"><div className="flex items-center gap-2 font-mono text-[11px] text-muted-foreground"><Clock3 className="size-3.5 text-aqua" />{formatarDataHora(registro.criadoEm)}</div></td><td className="px-4 py-3 align-top"><div className="flex items-center gap-2"><span className="grid size-7 place-items-center rounded-full bg-aqua/10 text-aqua"><UserRound className="size-3.5" /></span><div><p className="max-w-32 truncate font-medium">{registro.usuario?.nome ?? 'Sistema'}</p>{registro.usuario && <p className="font-mono text-[10px] text-muted-foreground">{registro.usuario.id.slice(0, 8)}...</p>}</div></div></td><td className="px-4 py-3 align-top"><span className="inline-flex rounded border border-aqua/30 bg-aqua/10 px-2 py-1 font-mono text-[11px] font-medium text-aqua">{nomeAcao(registro.acao)}</span></td><td className="px-4 py-3 align-top"><p className="font-medium">{registro.entidade}</p>{registro.entidadeId && <p className="mt-1 flex items-center gap-1 font-mono text-[10px] text-muted-foreground"><Hash className="size-3" />{registro.entidadeId.slice(0, 12)}...</p>}</td>{tecsus && <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px]">{nomeLicitacao(registro.licitacaoId, codigosLicitacao)}</td>}<td className="max-w-64 px-4 py-3 align-top"><p className="line-clamp-2 whitespace-pre-wrap font-mono text-[11px] text-muted-foreground">{formatarDetalhes(registro.detalhes)}</p></td></tr>)}</tbody></table></div> : <div className="grid min-h-64 place-items-center px-6 text-center"><div><ShieldCheck className="mx-auto mb-3 size-8 text-aqua" /><p className="font-display text-sm font-semibold">Nenhum registro encontrado</p><p className="mt-1 text-xs text-muted-foreground">Ajuste os filtros e faça uma nova consulta.</p></div></div>}
        {lista && lista.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><span className="font-mono text-[10px] text-muted-foreground">Página {lista.pagina} de {totalPaginas}</span><div className="flex gap-1"><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina <= 1 || carregando} onClick={() => { const consulta = { ...filtros, pagina: lista.pagina - 1 }; setFiltros(consulta); void carregar(consulta, lista.pagina - 1); }} aria-label="Página anterior"><ChevronLeft /></Button><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina >= totalPaginas || carregando} onClick={() => { const consulta = { ...filtros, pagina: lista.pagina + 1 }; setFiltros(consulta); void carregar(consulta, lista.pagina + 1); }} aria-label="Próxima página"><ChevronRight /></Button></div></div>}
      </article>

      <DetalheAuditoria registro={selecionado} licitacao={tecsus && selecionado ? nomeLicitacao(selecionado.licitacaoId, codigosLicitacao) : null} />
    </section>
  </div>;
}

function DetalheAuditoria({ registro, licitacao }: { registro: RegistroAuditoria | null; licitacao: string | null }) {
  const detalhes = registro?.detalhes && typeof registro.detalhes === 'object' && !Array.isArray(registro.detalhes)
    ? Object.fromEntries(Object.entries(registro.detalhes).filter(([chave]) => chave !== 'IP de origem (mascarado)'))
    : registro?.detalhes;

  return <aside className="h-fit overflow-hidden rounded-lg border border-border bg-card">
    <div className="border-b border-border px-4 py-3">
      <div className="flex items-center gap-2">
        <FileSearch className="size-4 text-warning" />
        <div>
          <h2 className="font-display text-sm font-semibold">Detalhes do registro</h2>
          <p className="font-mono text-[10px] text-muted-foreground">Contexto da atividade selecionada</p>
        </div>
      </div>
    </div>

    {!registro ? <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">Nenhum registro selecionado.</div> : <div className="space-y-5 p-4">
      <dl className="grid gap-x-4 gap-y-4 sm:grid-cols-2">
        <div className="min-w-0 border-l-2 border-aqua/50 pl-3">
          <dt className="font-mono text-[10px] uppercase text-muted-foreground">Data e hora</dt>
          <dd className="mt-1 flex items-center gap-2 text-sm"><CalendarDays className="size-4 shrink-0 text-aqua" />{formatarDataHora(registro.criadoEm)}</dd>
        </div>
        <div className="min-w-0 border-l-2 border-aqua/50 pl-3">
          <dt className="font-mono text-[10px] uppercase text-muted-foreground">Usuário</dt>
          <dd className="mt-1 flex items-center gap-2 text-sm"><UserRound className="size-4 shrink-0 text-aqua" />{registro.usuario?.nome ?? 'Não autenticado'}</dd>
          {registro.usuario && <dd className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{registro.usuario.id}</dd>}
        </div>
        <div className="min-w-0 border-l-2 border-warning/60 pl-3">
          <dt className="font-mono text-[10px] uppercase text-muted-foreground">IP de origem · mascarado</dt>
          <dd className="mt-1 break-all font-mono text-sm font-semibold text-warning">{registro.enderecoIp ?? 'Não registrado'}</dd>
        </div>
        <div className="min-w-0 border-l-2 border-lime/60 pl-3">
          <dt className="font-mono text-[10px] uppercase text-muted-foreground">Ação</dt>
          <dd className="mt-1 break-words font-mono text-sm text-lime">{registro.acao}</dd>
        </div>
        {licitacao && <div className="min-w-0 border-l-2 border-aqua/50 pl-3 sm:col-span-2">
          <dt className="font-mono text-[10px] uppercase text-muted-foreground">Licitação</dt>
          <dd className="mt-1 break-words font-mono text-sm">{licitacao}</dd>
        </div>}
        <div className="min-w-0 border-l-2 border-border pl-3 sm:col-span-2">
          <dt className="font-mono text-[10px] uppercase text-muted-foreground">Recurso afetado</dt>
          <dd className="mt-1 break-words text-sm">{registro.entidade}</dd>
          {registro.entidadeId && <dd className="mt-1 break-all font-mono text-[10px] text-muted-foreground">ID {registro.entidadeId}</dd>}
        </div>
      </dl>

      <section className="border-t border-border pt-4">
        <h3 className="font-mono text-[10px] uppercase text-muted-foreground">Dados do evento</h3>
        <div className="mt-3 max-h-72 space-y-2 overflow-auto rounded-md border border-border bg-muted/40 p-3 text-sm leading-relaxed">
          {formatarDetalhes(detalhes)}
        </div>
      </section>

      <div className="border-t border-border pt-3">
        <span className="font-mono text-[10px] text-muted-foreground">ID do registro</span>
        <p className="mt-1 break-all font-mono text-[10px] text-muted-foreground">{registro.id}</p>
      </div>
    </div>}
  </aside>;
}
