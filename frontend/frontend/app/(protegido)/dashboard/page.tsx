'use client';

import { useEffect, useState } from 'react';
import { ErroApi, api, type DashboardDados, type DashboardSerie } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;

function formatoDataLocal(data: Date) {
  const ajuste = data.getTimezoneOffset() * 60000;
  return new Date(data.getTime() - ajuste).toISOString().slice(0, 16);
}

function montarQuery(estacaoId: string, de: string, ate: string) {
  const query = new URLSearchParams();
  if (estacaoId) query.set('estacaoId', estacaoId);
  if (de) query.set('de', new Date(de).toISOString());
  if (ate) query.set('ate', new Date(ate).toISOString());
  return query.toString();
}

export default function DashboardPage() {
  const router = useRouter();
  const agora = new Date();
  const [estacaoId, setEstacaoId] = useState('');
  const [de, setDe] = useState(formatoDataLocal(new Date(agora.getTime() - UM_DIA_EM_MS)));
  const [ate, setAte] = useState(formatoDataLocal(agora));
  const [dados, setDados] = useState<DashboardDados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();

    api<DashboardDados>(`/dashboard?${montarQuery(estacaoId, de, ate)}`, { signal: controlador.signal })
      .then((resposta) => {
        setDados(resposta);
        if (estacaoId && !resposta.estacoes.some((estacao) => estacao.id === estacaoId)) {
          setEstacaoId('');
        }
      })
      .catch((erroCapturado: unknown) => {
        if (erroCapturado instanceof DOMException && erroCapturado.name === 'AbortError') return;
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.replace('/login');
          return;
        }
        setErro('Não foi possível carregar os dados do dashboard. Tente novamente.');
      })
      .finally(() => setCarregando(false));

    return () => controlador.abort();
  }, [ate, de, estacaoId, router, tentativa]);

  return (
    <div className="space-y-5">
      <PageHeading
        title="Dashboard"
        description="Acompanhe as leituras das estações no período selecionado."
      />

      <section className="rise delay-1 grid gap-2.5 sm:grid-cols-3" aria-label="Filtros do dashboard">
        <div className="flex flex-col gap-1">
          <label htmlFor="estacao" className="font-mono text-[10px] uppercase text-muted-foreground">Estação</label>
          <Select id="estacao" value={estacaoId} onChange={(event) => { setEstacaoId(event.target.value); setCarregando(true); setErro(null); }}>
            <option value="">Todas as estações</option>
            {dados?.estacoes.map((estacao) => <option key={estacao.id} value={estacao.id}>{estacao.nome}</option>)}
          </Select>
        </div>
        <CampoData label="De" value={de} onChange={(value) => { setDe(value); setCarregando(true); setErro(null); }} />
        <CampoData label="Até" value={ate} onChange={(value) => { setAte(value); setCarregando(true); setErro(null); }} />
      </section>

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{erro}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => { setCarregando(true); setErro(null); setTentativa((valor) => valor + 1); }}>
            Tentar novamente
          </Button>
        </div>
      )}

      {carregando && !dados ? (
        <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">Carregando dados reais...</div>
      ) : dados ? (
        <>
          <section className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4" aria-label="Indicadores">
            <Indicador titulo="Estações ativas" valor={dados.indicadores.estacoesAtivas} detalhe="com leituras no período" />
            <Indicador titulo="Leituras" valor={dados.indicadores.leituras} detalhe="registros processados" />
            <Indicador titulo="Média geral" valor={dados.indicadores.media === null ? '—' : dados.indicadores.media.toFixed(1)} detalhe="entre os parâmetros" />
            <Indicador titulo="Alertas abertos" valor={dados.indicadores.alarmesAbertos} detalhe="no período selecionado" />
          </section>

          {dados.series.length === 0 ? (
            <div className="rise delay-2 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
              <h2 className="font-display text-sm font-semibold">Nenhuma leitura encontrada</h2>
              <p className="mt-1 text-sm text-muted-foreground">Ajuste a estação ou o período para consultar outros dados.</p>
            </div>
          ) : (
            <section className="grid gap-4 lg:grid-cols-2" aria-label="Gráficos de leituras">
              {dados.series.map((serie) => <GraficoSerie key={`${serie.estacaoId}-${serie.parametroId}`} serie={serie} />)}
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}

function CampoData({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase text-muted-foreground">{label}</label>
      <input type="datetime-local" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 rounded-md border border-input bg-card px-3 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );
}

function Indicador({ titulo, valor, detalhe }: { titulo: string; valor: string | number; detalhe: string }) {
  return (
    <article className="rise delay-2 rounded-lg border border-border bg-card px-4 py-4">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">{titulo}</p>
      <p className="mt-2 font-display text-2xl font-semibold">{valor}</p>
      <p className="mt-1 text-xs text-muted-foreground">{detalhe}</p>
    </article>
  );
}

function GraficoSerie({ serie }: { serie: DashboardSerie }) {
  const valores = serie.pontos.map((ponto) => ponto.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;
  const pontos = serie.pontos.map((ponto, indice) => {
    const x = (indice / Math.max(serie.pontos.length - 1, 1)) * 100;
    const y = 92 - ((ponto.valor - minimo) / amplitude) * 76;
    return `${x},${y}`;
  }).join(' ');

  return (
    <article className="rise delay-3 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">{serie.nome}</h2>
          <p className="font-mono text-[10px] text-muted-foreground">{serie.estacaoNome} · {serie.pontos.length} pontos</p>
        </div>
        <span className="font-mono text-xs text-aqua">{serie.unidade}</span>
      </div>
      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between">
          <strong className="font-display text-xl">{serie.pontos.at(-1)?.valor.toFixed(1)}</strong>
          <span className="font-mono text-[10px] text-muted-foreground">última leitura</span>
        </div>
        <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="mt-4 h-40 w-full" role="img" aria-label={`Gráfico de ${serie.nome}`}>
          <path d="M0 92H100 M0 54H100 M0 16H100" stroke="currentColor" strokeOpacity=".1" vectorEffect="non-scaling-stroke" />
          <polyline points={pontos} fill="none" stroke="currentColor" className="text-aqua" strokeWidth="1.8" vectorEffect="non-scaling-stroke" />
        </svg>
      </div>
    </article>
  );
}