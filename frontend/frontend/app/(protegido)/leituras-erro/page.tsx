'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight, FileSearch, Filter, RefreshCw, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api, ErroApi, type LeituraErro, type MotivoLeituraErro, type Paginado } from '@/lib/api';
import { formatarFaixa } from '@/lib/faixa-sensor';
import { ehTecsus } from '@/lib/perfil';
import { cn } from '@/lib/utils';
import { useCodigosLicitacao } from '@/lib/licitacoes';

const TAMANHO_PAGINA = 50;

interface FiltrosLeiturasErro {
  vidEstacao: string;
  motivo: MotivoLeituraErro | '';
  de: string;
  ate: string;
  licitacaoId: string;
}

const FILTROS_INICIAIS: FiltrosLeiturasErro = { vidEstacao: '', motivo: '', de: '', ate: '', licitacaoId: '' };

const MOTIVOS: Record<MotivoLeituraErro, { rotulo: string; descricao: string; tom: string }> = {
  ESTACAO_NAO_CADASTRADA: {
    rotulo: 'Estação não cadastrada',
    descricao: 'Nenhuma estação tem este VID.',
    tom: 'border-destructive/30 bg-destructive/10 text-destructive',
  },
  SENSOR_NAO_CONFIGURADO: {
    rotulo: 'Sensor não configurado',
    descricao: 'A estação não tem este sensor associado.',
    tom: 'border-warning/30 bg-warning/10 text-warning',
  },
  ABAIXO_DO_MINIMO: {
    rotulo: 'Abaixo do mínimo',
    descricao: 'Valor menor que o limite físico do sensor.',
    tom: 'border-aqua/30 bg-aqua/10 text-aqua',
  },
  ACIMA_DO_MAXIMO: {
    rotulo: 'Acima do máximo',
    descricao: 'Valor maior que o limite físico do sensor.',
    tom: 'border-warning/30 bg-warning/10 text-warning',
  },
};

function formatarDataHora(valor: string | Date): string {
  const data = new Date(valor);
  if (Number.isNaN(data.getTime())) return String(valor);
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'medium' }).format(data);
}

// O unixtime vem do datalogger, em segundos.
function formatarUnixtime(unixtime: string): string {
  const segundos = Number(unixtime);
  return Number.isFinite(segundos) ? formatarDataHora(new Date(segundos * 1000)) : unixtime;
}

function formatarValor(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 4 }).format(valor);
}

function parametrosConsulta(filtros: FiltrosLeiturasErro, pagina: number): URLSearchParams {
  const parametros = new URLSearchParams({ pagina: String(pagina), tamanho: String(TAMANHO_PAGINA) });
  if (filtros.vidEstacao.trim()) parametros.set('vidEstacao', filtros.vidEstacao.trim());
  if (filtros.motivo) parametros.set('motivo', filtros.motivo);
  if (filtros.licitacaoId) parametros.set('licitacaoId', filtros.licitacaoId);
  if (filtros.de) parametros.set('de', new Date(`${filtros.de}T00:00:00`).toISOString());
  if (filtros.ate) parametros.set('ate', new Date(`${filtros.ate}T23:59:59.999`).toISOString());
  return parametros;
}

function Motivo({ leitura }: { leitura: LeituraErro }) {
  const motivo = MOTIVOS[leitura.motivo];
  const temFaixa = leitura.valorMinimo !== null || leitura.valorMaximo !== null;

  return (
    <div>
      <span className={cn('inline-flex rounded border px-2 py-1 font-mono text-[11px] font-medium', motivo?.tom)}>
        {motivo?.rotulo ?? leitura.motivo}
      </span>
      <p className="mt-1 text-xs text-muted-foreground">
        {temFaixa ? `Faixa válida: ${formatarFaixa(leitura.valorMinimo, leitura.valorMaximo)}` : motivo?.descricao}
      </p>
    </div>
  );
}

export default function LeiturasErroPage() {
  const router = useRouter();
  const tecsus = ehTecsus(useUsuario());
  const codigosLicitacao = useCodigosLicitacao(tecsus);

  const [filtros, setFiltros] = useState<FiltrosLeiturasErro>(FILTROS_INICIAIS);
  // A paginação segue a última consulta, não o que foi digitado e ainda não aplicado.
  const [aplicados, setAplicados] = useState<FiltrosLeiturasErro>(FILTROS_INICIAIS);
  const [lista, setLista] = useState<Paginado<LeituraErro> | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (consulta: FiltrosLeiturasErro, pagina = 1) => {
      setCarregando(true);
      setErro(null);
      setAplicados(consulta);
      try {
        setLista(await api<Paginado<LeituraErro>>(`/leituras-erro?${parametrosConsulta(consulta, pagina)}`));
      } catch (erroCapturado) {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.replace('/login?proximo=/leituras-erro');
          return;
        }
        setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Não foi possível carregar as leituras com erro.');
        setLista(null);
      } finally {
        setCarregando(false);
      }
    },
    [router],
  );

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

  const totalPaginas = lista ? Math.max(1, Math.ceil(lista.total / lista.tamanho)) : 1;
  const periodo =
    aplicados.de && aplicados.ate
      ? `${aplicados.de} a ${aplicados.ate}`
      : aplicados.de
        ? `Desde ${aplicados.de}`
        : aplicados.ate
          ? `Até ${aplicados.ate}`
          : 'Todo o histórico';

  return (
    <div className="space-y-5">
      <PageHeading
        title="Leituras com erro"
        description="Leituras que chegaram das estações mas foram recusadas pelo tratamento e não viraram medida."
      />

      <section className="grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Leituras recusadas</span>
            <AlertTriangle className="size-4 text-warning" />
          </div>
          <p className="mt-2 font-display text-2xl font-semibold">{lista?.total ?? '—'}</p>
        </article>
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Período selecionado</span>
            <Filter className="size-4 text-aqua" />
          </div>
          <p className="mt-2 font-display text-lg font-semibold">{periodo}</p>
        </article>
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <div className="flex items-center justify-between">
            <span className="font-mono text-[10px] uppercase text-muted-foreground">Página</span>
            <CalendarDays className="size-4 text-lime" />
          </div>
          <p className="mt-2 font-display text-2xl font-semibold">{lista ? `${lista.pagina} / ${totalPaginas}` : '—'}</p>
        </article>
      </section>

      <form onSubmit={consultar} className="rounded-lg border border-border bg-card p-4">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="size-4 text-aqua" />
          <h2 className="font-display text-sm font-semibold">Filtros da consulta</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">
            VID da estação
            <Input
              maxLength={64}
              placeholder="Parte do UUID ou MAC"
              value={filtros.vidEstacao}
              onChange={(evento) => setFiltros((atual) => ({ ...atual, vidEstacao: evento.target.value }))}
            />
          </label>
          <label className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">
            Motivo
            <Select
              value={filtros.motivo}
              onChange={(evento) => setFiltros((atual) => ({ ...atual, motivo: evento.target.value as MotivoLeituraErro | '' }))}
            >
              <option value="">Todos os motivos</option>
              {(Object.keys(MOTIVOS) as MotivoLeituraErro[]).map((motivo) => (
                <option key={motivo} value={motivo}>
                  {MOTIVOS[motivo].rotulo}
                </option>
              ))}
            </Select>
          </label>
          {tecsus && (
            <label className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">
              Licitação
              <SeletorLicitacao
                valor={filtros.licitacaoId}
                onChange={(licitacaoId) => setFiltros((atual) => ({ ...atual, licitacaoId }))}
                rotuloTodas="Todas as licitações"
              />
            </label>
          )}
          <label className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">
            Data inicial
            <Input type="date" value={filtros.de} onChange={(evento) => setFiltros((atual) => ({ ...atual, de: evento.target.value }))} />
          </label>
          <label className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">
            Data final
            <Input type="date" value={filtros.ate} onChange={(evento) => setFiltros((atual) => ({ ...atual, ate: evento.target.value }))} />
          </label>
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1" disabled={carregando}>
              <FileSearch />
              {carregando ? 'Consultando...' : 'Aplicar filtros'}
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-9" onClick={limparFiltros} disabled={carregando} aria-label="Limpar filtros">
              <X />
            </Button>
          </div>
        </div>
      </form>

      {erro && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erro}
        </div>
      )}

      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Leituras com erro">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-semibold">Leituras recusadas</h2>
            <p className="font-mono text-[10px] text-muted-foreground">
              {lista ? `${lista.total} leitura(s) · página ${lista.pagina} de ${totalPaginas}` : 'Carregando registros...'}
            </p>
          </div>
          {carregando && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {carregando && !lista ? (
          <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">Carregando leituras...</div>
        ) : lista?.itens.length ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[860px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Registrada em</th>
                  <th className="px-4 py-3 font-medium">Estação</th>
                  <th className="px-4 py-3 font-medium">Sensor</th>
                  <th className="px-4 py-3 font-medium">Valor</th>
                  <th className="px-4 py-3 font-medium">Motivo</th>
                  {tecsus && <th className="px-4 py-3 font-medium">Licitação</th>}
                </tr>
              </thead>
              <tbody>
                {lista.itens.map((leitura) => (
                  <tr key={leitura.id} className="border-b border-border last:border-0 hover:bg-muted/30">
                    <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px] text-muted-foreground">
                      {formatarDataHora(leitura.registradoEm)}
                      <p className="mt-1 text-[10px]" title={`Unix time ${leitura.unixtime}`}>
                        Lida em {formatarUnixtime(leitura.unixtime)}
                      </p>
                    </td>
                    <td className="px-4 py-3 align-top">
                      <p className="break-all font-medium">{leitura.vidEstacao}</p>
                    </td>
                    <td className="px-4 py-3 align-top">{leitura.nomeSensor}</td>
                    <td className="whitespace-nowrap px-4 py-3 align-top font-display font-semibold tabular-nums">
                      {formatarValor(leitura.valor)}
                    </td>
                    <td className="px-4 py-3 align-top">
                      <Motivo leitura={leitura} />
                    </td>
                    {tecsus && (
                      <td className="whitespace-nowrap px-4 py-3 align-top font-mono text-[11px]">
                        {leitura.licitacaoId ? (codigosLicitacao.get(leitura.licitacaoId) ?? leitura.licitacaoId.slice(0, 8)) : '—'}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">
            Nenhuma leitura com erro para os filtros informados.
          </div>
        )}

        {lista && lista.total > 0 && (
          <div className="flex items-center justify-between border-t border-border px-4 py-3">
            <span className="font-mono text-[10px] text-muted-foreground">
              Página {lista.pagina} de {totalPaginas}
            </span>
            <div className="flex gap-1">
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                disabled={lista.pagina <= 1 || carregando}
                onClick={() => void carregar(aplicados, lista.pagina - 1)}
                aria-label="Página anterior"
              >
                <ChevronLeft />
              </Button>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-7"
                disabled={lista.pagina >= totalPaginas || carregando}
                onClick={() => void carregar(aplicados, lista.pagina + 1)}
                aria-label="Próxima página"
              >
                <ChevronRight />
              </Button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
