'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Database, Download, FileSearch, FileSpreadsheet, Filter, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { baixarPlanilha } from '@/lib/baixar-planilha';
import { api, baixarDaApi, ErroApi, type LeituraBruta, type ListaLeiturasBrutas } from '@/lib/api';
import { ehTecsus } from '@/lib/perfil';
import { useCodigosLicitacao } from '@/lib/licitacoes';

const TAMANHO_PAGINA = 50;
const FILTROS_INICIAIS = { vidEstacao: '', campo: '', de: '', ate: '', licitacaoId: '' };
// O Excel formatado é montado no navegador (exceljs), sem streaming: acima
// disso a aba trava. Para volumes maiores existe o CSV gerado pela API.
const LIMITE_PLANILHA = 5000;
const TAMANHO_LOTE_PLANILHA = 200;

type FiltrosLeituras = typeof FILTROS_INICIAIS;

function formatarDataHora(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(data);
}

function parametrosFiltro(filtros: FiltrosLeituras): URLSearchParams {
  const parametros = new URLSearchParams();
  if (filtros.vidEstacao.trim()) parametros.set('vidEstacao', filtros.vidEstacao.trim());
  if (filtros.campo.trim()) parametros.set('campo', filtros.campo.trim());
  if (filtros.licitacaoId) parametros.set('licitacaoId', filtros.licitacaoId);
  if (filtros.de) parametros.set('de', new Date(`${filtros.de}T00:00:00`).toISOString());
  if (filtros.ate) parametros.set('ate', new Date(`${filtros.ate}T23:59:59.999`).toISOString());
  return parametros;
}

function parametrosConsulta(filtros: FiltrosLeituras, pagina: number, tamanho = TAMANHO_PAGINA): URLSearchParams {
  const parametros = parametrosFiltro(filtros);
  parametros.set('pagina', String(pagina));
  parametros.set('tamanho', String(tamanho));
  return parametros;
}

/** A API recusa exportar sem período (varreria a tabela inteira); aqui o aviso vem antes do clique virar navegação. */
function problemaPeriodoExportacao(filtros: FiltrosLeituras): string | null {
  if (!filtros.de || !filtros.ate) return 'Informe a data inicial e a data final para exportar o CSV.';
  if (filtros.de > filtros.ate) return 'A data inicial deve ser anterior ou igual à data final.';
  return null;
}

function valorPayloadPlanilha(valor: unknown): string | number | boolean | null {
  if (valor === null || valor === undefined) return null;
  if (typeof valor === 'number' || typeof valor === 'boolean' || typeof valor === 'string') return valor;
  return String(valor);
}

interface CampoPayload {
  chave: string;
  valor: unknown;
}

function tentarLerObjetoJson(valor: string): unknown {
  try {
    const convertido: unknown = JSON.parse(valor);
    return convertido && typeof convertido === 'object' ? convertido : valor;
  } catch {
    return valor;
  }
}

function extrairCamposPayload(valor: unknown, prefixo = ''): CampoPayload[] {
  if (typeof valor === 'string') {
    const convertido = tentarLerObjetoJson(valor);
    if (convertido !== valor) return extrairCamposPayload(convertido, prefixo);
  }

  if (Array.isArray(valor)) {
    return valor.flatMap((item, indice) => extrairCamposPayload(item, prefixo ? `${prefixo} ${indice + 1}` : `Item ${indice + 1}`));
  }

  if (valor && typeof valor === 'object') {
    return Object.entries(valor).flatMap(([chave, conteudo]) => {
      const nome = prefixo ? `${prefixo} · ${chave}` : chave;
      return conteudo !== null && typeof conteudo === 'object'
        ? extrairCamposPayload(conteudo, nome)
        : [{ chave: nome, valor: conteudo }];
    });
  }

  return [{ chave: prefixo || 'Valor', valor }];
}

function textoPayload(valor: unknown): string {
  if (valor === null || valor === undefined) return 'Sem valor';
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  if (typeof valor === 'number') return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);
  return String(valor);
}

function CamposPayload({ valor }: { valor: unknown }) {
  const campos = extrairCamposPayload(valor);
  if (!campos.length) return <span className="text-xs text-muted-foreground">Sem valores recebidos</span>;

  return <dl className="grid grid-cols-2 gap-x-3 gap-y-2 lg:grid-cols-3">
    {campos.map((campo, indice) => <div key={`${campo.chave}-${indice}`} className="min-w-0 border-l-2 border-aqua/40 pl-2">
      <dt className="truncate font-mono text-[9px] uppercase text-muted-foreground" title={campo.chave}>{campo.chave}</dt>
      <dd className="mt-0.5 break-words font-display text-sm font-semibold tabular-nums text-foreground">{textoPayload(campo.valor)}</dd>
    </div>)}
  </dl>;
}

export default function LeiturasBrutasPage() {
  const router = useRouter();
  const tecsus = ehTecsus(useUsuario());
  const codigosLicitacao = useCodigosLicitacao(tecsus);
  const [filtros, setFiltros] = useState<FiltrosLeituras>(FILTROS_INICIAIS);
  // A paginação segue a última consulta, não o que foi digitado e ainda não aplicado.
  const [aplicados, setAplicados] = useState<FiltrosLeituras>(FILTROS_INICIAIS);
  const [lista, setLista] = useState<ListaLeiturasBrutas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportandoPlanilha, setExportandoPlanilha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async (consulta: FiltrosLeituras, pagina = 1) => {
    setCarregando(true);
    setErro(null);
    setAplicados(consulta);
    try {
      const dados = await api<ListaLeiturasBrutas>(`/leituras-brutas?${parametrosConsulta(consulta, pagina)}`);
      setLista(dados);
    } catch (erroCapturado) {
      if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
        router.replace('/login?proximo=/leituras-brutas');
        return;
      }
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Não foi possível carregar as leituras brutas.');
      setLista(null);
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta inicial da listagem
    void carregar(FILTROS_INICIAIS);
  }, [carregar]);

  function consultar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setAviso(null);
    void carregar(filtros);
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    setAviso(null);
    void carregar(FILTROS_INICIAIS);
  }

  /** Até LIMITE_PLANILHA leituras; acima disso devolve null e avisa, sem baixar nada. */
  async function buscarLeiturasDaPlanilha(): Promise<LeituraBruta[] | null> {
    const primeiraPagina = await api<ListaLeiturasBrutas>(`/leituras-brutas?${parametrosConsulta(filtros, 1, TAMANHO_LOTE_PLANILHA)}`);
    if (primeiraPagina.total > LIMITE_PLANILHA) {
      setAviso(`A consulta tem ${primeiraPagina.total.toLocaleString('pt-BR')} leituras e o Excel formatado vai até ${LIMITE_PLANILHA.toLocaleString('pt-BR')}. Reduza o período ou use o CSV, que não tem esse limite.`);
      return null;
    }

    const leituras = [...primeiraPagina.itens];
    const totalPaginas = Math.ceil(primeiraPagina.total / TAMANHO_LOTE_PLANILHA);
    for (let pagina = 2; pagina <= totalPaginas; pagina += 1) {
      const proximaPagina = await api<ListaLeiturasBrutas>(`/leituras-brutas?${parametrosConsulta(filtros, pagina, TAMANHO_LOTE_PLANILHA)}`);
      leituras.push(...proximaPagina.itens);
    }
    return leituras.slice(0, LIMITE_PLANILHA);
  }

  function resumoFiltros(): string {
    const ativos = [
      filtros.licitacaoId && `Licitação: ${codigosLicitacao.get(filtros.licitacaoId) ?? filtros.licitacaoId}`,
      filtros.vidEstacao.trim() && `Estação: ${filtros.vidEstacao.trim()}`,
      filtros.campo.trim() && `Campo: ${filtros.campo.trim()}`,
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
    baixarDaApi(`/leituras-brutas/exportar?${parametrosFiltro(filtros)}`);
  }

  async function exportarPlanilha() {
    setExportandoPlanilha(true);
    setErro(null);
    setAviso(null);
    try {
      const leituras = await buscarLeiturasDaPlanilha();
      if (!leituras) return;
      const valoresPayload = leituras.map((leitura) => Object.fromEntries(
        extrairCamposPayload(leitura.payload).map((campo) => [campo.chave, valorPayloadPlanilha(campo.valor)]),
      ));
      const camposPayload = [...new Set(valoresPayload.flatMap((valores) => Object.keys(valores)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const linhas = leituras.map((leitura, indice) => [
        leitura.id,
        leitura.vidEstacao,
        new Date(leitura.recebidoEm),
        leitura.unixtimeDispositivo,
        leitura.latitude,
        leitura.longitude,
        ...camposPayload.map((campo) => valoresPayload[indice][campo] ?? null),
      ]);

      await baixarPlanilha({
        nomeArquivo: 'leituras-brutas.xlsx',
        nomeAba: 'Leituras brutas',
        titulo: 'Relatório de leituras brutas',
        subtitulo: `${resumoFiltros()} · Gerado em ${formatarDataHora(new Date().toISOString())}`,
        cabecalhos: ['ID da leitura', 'VID da estação', 'Recebida em', 'Unix time do dispositivo', 'Latitude', 'Longitude', ...camposPayload.map((campo) => `Leitura: ${campo}`)],
        linhas,
        larguras: [40, 28, 22, 26, 16, 16, ...camposPayload.map(() => 22)],
        colunasData: [3],
        colunasNumero: [5, 6],
        colunasComQuebra: camposPayload.map((_, indice) => indice + 7),
      });
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Não foi possível gerar a planilha de leituras.');
    } finally {
      setExportandoPlanilha(false);
    }
  }

  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.tamanho)) : 1;
  const campoFiltro = 'flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground';

  return <div className="space-y-5">
    <PageHeading title="Leituras brutas" description="Dados originais recebidos das estações, antes do processamento dos sensores." />

    <section className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-muted-foreground">Leituras encontradas</span><Database className="size-4 text-aqua" /></div><p className="mt-2 font-display text-2xl font-semibold">{lista?.total ?? '—'}</p></article>
      <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-muted-foreground">Período selecionado</span><Filter className="size-4 text-warning" /></div><p className="mt-2 font-display text-lg font-semibold">{aplicados.de && aplicados.ate ? `${aplicados.de} a ${aplicados.ate}` : aplicados.de ? `Desde ${aplicados.de}` : aplicados.ate ? `Até ${aplicados.ate}` : 'Todo o histórico'}</p></article>
      <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-muted-foreground">Página</span><CalendarDays className="size-4 text-lime" /></div><p className="mt-2 font-display text-2xl font-semibold">{lista ? `${lista.pagina} / ${totalPaginas}` : '—'}</p></article>
    </section>

    <form onSubmit={consultar} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2"><Filter className="size-4 text-aqua" /><h2 className="font-display text-sm font-semibold">Filtros da consulta</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={campoFiltro}>VID da estação<Input maxLength={64} placeholder="Parte do UUID ou MAC" value={filtros.vidEstacao} onChange={(evento) => setFiltros((atual) => ({ ...atual, vidEstacao: evento.target.value }))} /></label>
        <label className={campoFiltro}>Campo do payload<Input maxLength={100} placeholder="Nome do parâmetro" value={filtros.campo} onChange={(evento) => setFiltros((atual) => ({ ...atual, campo: evento.target.value }))} /></label>
        {tecsus && <label className={campoFiltro}>Licitação<SeletorLicitacao valor={filtros.licitacaoId} onChange={(licitacaoId) => setFiltros((atual) => ({ ...atual, licitacaoId }))} rotuloTodas="Todas as licitações" /></label>}
        <label className={campoFiltro}>Data inicial<Input type="date" value={filtros.de} onChange={(evento) => setFiltros((atual) => ({ ...atual, de: evento.target.value }))} /></label>
        <label className={campoFiltro}>Data final<Input type="date" value={filtros.ate} onChange={(evento) => setFiltros((atual) => ({ ...atual, ate: evento.target.value }))} /></label>
        <div className="flex items-end gap-2"><Button type="submit" className="flex-1" disabled={carregando}><FileSearch />{carregando ? 'Consultando...' : 'Aplicar filtros'}</Button><Button type="button" variant="outline" size="icon" className="size-9" onClick={limparFiltros} disabled={carregando} aria-label="Limpar filtros"><X /></Button></div>
      </div>
      <div className="mt-4 flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-xs text-muted-foreground">A exportação usa os filtros acima. O CSV exige data inicial e final; o Excel formatado vai até {LIMITE_PLANILHA.toLocaleString('pt-BR')} leituras.</p>
        <div className="flex flex-wrap gap-2"><Button type="button" variant="outline" onClick={exportarCsv} disabled={exportandoPlanilha}><Download />CSV</Button><Button type="button" onClick={() => void exportarPlanilha()} disabled={exportandoPlanilha}><FileSpreadsheet />{exportandoPlanilha ? 'Gerando...' : 'Excel formatado'}</Button></div>
      </div>
    </form>

    {erro && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>}
    {aviso && <div role="status" className="rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-sm text-foreground">{aviso}</div>}

    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Leituras brutas">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="font-display text-sm font-semibold">Registros recebidos</h2><p className="font-mono text-[10px] text-muted-foreground">{lista ? `${lista.total} leitura(s) · página ${lista.pagina} de ${totalPaginas}` : 'Carregando registros...'}</p></div>{carregando && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}</div>
      {carregando && !lista ? <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">Carregando leituras...</div> : lista?.itens.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Recebida em</th><th className="px-4 py-3 font-medium">Estação</th><th className="px-4 py-3 font-medium">Localização</th><th className="px-4 py-3 font-medium">Valores recebidos</th></tr></thead><tbody>{lista.itens.map((leitura) => <tr key={leitura.id} className="border-b border-border last:border-0 hover:bg-muted/30"><td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">{formatarDataHora(leitura.recebidoEm)}</td><td className="px-4 py-3 align-top"><p className="font-medium">{leitura.vidEstacao}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{leitura.id.slice(0, 12)}...</p></td><td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">{leitura.latitude.toFixed(5)}, {leitura.longitude.toFixed(5)}</td><td className="max-w-xl px-4 py-3 align-top"><CamposPayload valor={leitura.payload} /></td></tr>)}</tbody></table></div> : <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">Nenhuma leitura encontrada para os filtros informados.</div>}
      {lista && lista.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><span className="font-mono text-[10px] text-muted-foreground">Página {lista.pagina} de {totalPaginas}</span><div className="flex gap-1"><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina <= 1 || carregando} onClick={() => void carregar(aplicados, lista.pagina - 1)} aria-label="Página anterior"><ChevronLeft /></Button><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina >= totalPaginas || carregando} onClick={() => void carregar(aplicados, lista.pagina + 1)} aria-label="Próxima página"><ChevronRight /></Button></div></div>}
    </section>
  </div>;
}
