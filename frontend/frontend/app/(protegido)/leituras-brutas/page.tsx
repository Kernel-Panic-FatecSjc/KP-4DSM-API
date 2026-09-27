'use client';

import { useCallback, useEffect, useState } from 'react';
import { CalendarDays, ChevronLeft, ChevronRight, Database, Download, FileSearch, FileSpreadsheet, Filter, RefreshCw, X } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { baixarPlanilha } from '@/lib/baixar-planilha';
import { api, ErroApi, type LeituraBruta, type ListaLeiturasBrutas } from '@/lib/api';

const TAMANHO_PAGINA = 50;
const FILTROS_INICIAIS = { vidEstacao: '', campo: '', de: '', ate: '' };

type FiltrosLeituras = typeof FILTROS_INICIAIS;

function formatarDataHora(valor: string): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return valor;
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(data);
}

function parametrosConsulta(filtros: FiltrosLeituras, pagina: number, tamanho = TAMANHO_PAGINA): URLSearchParams {
  const parametros = new URLSearchParams({ pagina: String(pagina), tamanho: String(tamanho) });
  if (filtros.vidEstacao.trim()) parametros.set('vidEstacao', filtros.vidEstacao.trim());
  if (filtros.campo.trim()) parametros.set('campo', filtros.campo.trim());
  if (filtros.de) parametros.set('de', new Date(`${filtros.de}T00:00:00`).toISOString());
  if (filtros.ate) parametros.set('ate', new Date(`${filtros.ate}T23:59:59.999`).toISOString());
  return parametros;
}

function valorCsv(valor: unknown): string {
  const texto = typeof valor === 'string' ? valor : JSON.stringify(valor ?? '');
  const protegido = /^[=+@\-]/.test(texto) ? `'${texto}` : texto;
  return `"${protegido.replaceAll('"', '""')}"`;
}

function numeroCsv(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { useGrouping: false, maximumFractionDigits: 6 }).format(valor);
}

function valorPayloadCsv(valor: unknown): string {
  if (valor === null || valor === undefined) return '';
  if (typeof valor === 'number') return numeroCsv(valor);
  if (typeof valor === 'boolean') return valor ? 'Sim' : 'Não';
  return String(valor);
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
  const [filtros, setFiltros] = useState<FiltrosLeituras>(FILTROS_INICIAIS);
  const [lista, setLista] = useState<ListaLeiturasBrutas | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [exportando, setExportando] = useState(false);
  const [exportandoPlanilha, setExportandoPlanilha] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async (consulta: FiltrosLeituras, pagina = 1) => {
    setCarregando(true);
    setErro(null);
    try {
      const dados = await api<ListaLeiturasBrutas>(`/leituras-brutas?${parametrosConsulta(consulta, pagina)}`);
      setLista(dados);
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Não foi possível carregar as leituras brutas.');
      setLista(null);
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta inicial da listagem
    void carregar(FILTROS_INICIAIS);
  }, [carregar]);

  function consultar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    void carregar(filtros);
  }

  function limparFiltros() {
    setFiltros(FILTROS_INICIAIS);
    void carregar(FILTROS_INICIAIS);
  }

  async function buscarTodasLeituras(): Promise<LeituraBruta[]> {
    const primeiraPagina = await api<ListaLeiturasBrutas>(`/leituras-brutas?${parametrosConsulta(filtros, 1, 200)}`);
    const leituras = [...primeiraPagina.itens];
    const totalPaginas = Math.ceil(primeiraPagina.total / primeiraPagina.tamanho);

    for (let pagina = 2; pagina <= totalPaginas; pagina += 1) {
      const proximaPagina = await api<ListaLeiturasBrutas>(`/leituras-brutas?${parametrosConsulta(filtros, pagina, 200)}`);
      leituras.push(...proximaPagina.itens);
    }

    return leituras;
  }

  function resumoFiltros(): string {
    const ativos = [
      filtros.vidEstacao.trim() && `Estação: ${filtros.vidEstacao.trim()}`,
      filtros.campo.trim() && `Campo: ${filtros.campo.trim()}`,
      filtros.de && `De: ${filtros.de}`,
      filtros.ate && `Até: ${filtros.ate}`,
    ].filter(Boolean);
    return ativos.length ? `Filtros: ${ativos.join(' · ')}` : 'Filtros: nenhum';
  }

  async function exportarCsv() {
    setExportando(true);
    setErro(null);
    try {
      const leituras = await buscarTodasLeituras();
      const valoresPayload = leituras.map((leitura) => Object.fromEntries(
        extrairCamposPayload(leitura.payload).map((campo) => [campo.chave, valorPayloadCsv(campo.valor)]),
      ));
      const camposPayload = [...new Set(valoresPayload.flatMap((valores) => Object.keys(valores)))].sort((a, b) => a.localeCompare(b, 'pt-BR'));
      const cabecalho = ['ID da leitura', 'VID da estação', 'Recebida em', 'Unix time do dispositivo', 'Latitude', 'Longitude', ...camposPayload.map((campo) => `Leitura: ${campo}`)];
      const linhas = leituras.map((leitura: LeituraBruta, indice) => [
        leitura.id,
        leitura.vidEstacao,
        formatarDataHora(leitura.recebidoEm),
        leitura.unixtimeDispositivo,
        numeroCsv(leitura.latitude),
        numeroCsv(leitura.longitude),
        ...camposPayload.map((campo) => valoresPayload[indice][campo] ?? ''),
      ]);
      const conteudo = `\uFEFF${[cabecalho, ...linhas].map((linha) => linha.map(valorCsv).join(';')).join('\r\n')}`;
      const arquivo = URL.createObjectURL(new Blob([conteudo], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = arquivo;
      link.download = 'leituras-brutas.csv';
      link.click();
      URL.revokeObjectURL(arquivo);
    } catch (erroCapturado) {
      setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Não foi possível gerar o CSV.');
    } finally {
      setExportando(false);
    }
  }

  async function exportarPlanilha() {
    setExportandoPlanilha(true);
    setErro(null);
    try {
      const leituras = await buscarTodasLeituras();
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

  return <div className="space-y-5">
    <PageHeading title="Leituras brutas" description="Dados originais recebidos das estações, antes do processamento dos sensores." action={<div className="flex flex-wrap items-center gap-2"><Button type="button" variant="outline" onClick={() => void exportarCsv()} disabled={!lista?.total || exportando || exportandoPlanilha}><Download />{exportando ? 'Preparando CSV...' : 'CSV'}</Button><Button type="button" onClick={() => void exportarPlanilha()} disabled={!lista?.total || exportando || exportandoPlanilha}><FileSpreadsheet />{exportandoPlanilha ? 'Gerando...' : 'Excel formatado'}</Button></div>} />

    <section className="grid gap-3 sm:grid-cols-3">
      <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-muted-foreground">Leituras encontradas</span><Database className="size-4 text-aqua" /></div><p className="mt-2 font-display text-2xl font-semibold">{lista?.total ?? '—'}</p></article>
      <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-muted-foreground">Período selecionado</span><Filter className="size-4 text-warning" /></div><p className="mt-2 font-display text-lg font-semibold">{filtros.de && filtros.ate ? `${filtros.de} a ${filtros.ate}` : filtros.de ? `Desde ${filtros.de}` : filtros.ate ? `Até ${filtros.ate}` : 'Todo o histórico'}</p></article>
      <article className="rounded-lg border border-border bg-card px-4 py-4"><div className="flex items-center justify-between"><span className="font-mono text-[10px] uppercase text-muted-foreground">Página</span><CalendarDays className="size-4 text-lime" /></div><p className="mt-2 font-display text-2xl font-semibold">{lista ? `${lista.pagina} / ${totalPaginas}` : '—'}</p></article>
    </section>

    <form onSubmit={consultar} className="rounded-lg border border-border bg-card p-4">
      <div className="mb-4 flex items-center gap-2"><Filter className="size-4 text-aqua" /><h2 className="font-display text-sm font-semibold">Filtros da consulta</h2></div>
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">VID da estação<Input maxLength={64} placeholder="Parte do UUID ou MAC" value={filtros.vidEstacao} onChange={(evento) => setFiltros((atual) => ({ ...atual, vidEstacao: evento.target.value }))} /></label>
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">Campo do payload<Input maxLength={100} placeholder="Nome do parâmetro" value={filtros.campo} onChange={(evento) => setFiltros((atual) => ({ ...atual, campo: evento.target.value }))} /></label>
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">Data inicial<Input type="date" value={filtros.de} onChange={(evento) => setFiltros((atual) => ({ ...atual, de: evento.target.value }))} /></label>
        <label className="flex flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">Data final<Input type="date" value={filtros.ate} onChange={(evento) => setFiltros((atual) => ({ ...atual, ate: evento.target.value }))} /></label>
        <div className="flex items-end gap-2"><Button type="submit" className="w-full" disabled={carregando}><FileSearch />{carregando ? 'Consultando...' : 'Aplicar filtros'}</Button><Button type="button" variant="outline" size="icon" onClick={limparFiltros} disabled={carregando} aria-label="Limpar filtros"><X /></Button></div>
      </div>
    </form>

    {erro && <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">{erro}</div>}

    <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Leituras brutas">
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3"><div><h2 className="font-display text-sm font-semibold">Registros recebidos</h2><p className="font-mono text-[10px] text-muted-foreground">{lista ? `${lista.total} leitura(s) · página ${lista.pagina} de ${totalPaginas}` : 'Carregando registros...'}</p></div>{carregando && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}</div>
      {carregando && !lista ? <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">Carregando leituras...</div> : lista?.itens.length ? <div className="overflow-x-auto"><table className="w-full min-w-[800px] text-left text-sm"><thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase text-muted-foreground"><tr><th className="px-4 py-3 font-medium">Recebida em</th><th className="px-4 py-3 font-medium">Estação</th><th className="px-4 py-3 font-medium">Localização</th><th className="px-4 py-3 font-medium">Valores recebidos</th></tr></thead><tbody>{lista.itens.map((leitura) => <tr key={leitura.id} className="border-b border-border last:border-0 hover:bg-muted/30"><td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">{formatarDataHora(leitura.recebidoEm)}</td><td className="px-4 py-3 align-top"><p className="font-medium">{leitura.vidEstacao}</p><p className="mt-1 font-mono text-[10px] text-muted-foreground">{leitura.id.slice(0, 12)}...</p></td><td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">{leitura.latitude.toFixed(5)}, {leitura.longitude.toFixed(5)}</td><td className="max-w-xl px-4 py-3 align-top"><CamposPayload valor={leitura.payload} /></td></tr>)}</tbody></table></div> : <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">Nenhuma leitura encontrada para os filtros informados.</div>}
      {lista && lista.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-3"><span className="font-mono text-[10px] text-muted-foreground">Página {lista.pagina} de {totalPaginas}</span><div className="flex gap-1"><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina <= 1 || carregando} onClick={() => void carregar(filtros, lista.pagina - 1)} aria-label="Página anterior"><ChevronLeft /></Button><Button type="button" variant="outline" size="icon" className="size-7" disabled={lista.pagina >= totalPaginas || carregando} onClick={() => void carregar(filtros, lista.pagina + 1)} aria-label="Próxima página"><ChevronRight /></Button></div></div>}
    </section>
  </div>;
}