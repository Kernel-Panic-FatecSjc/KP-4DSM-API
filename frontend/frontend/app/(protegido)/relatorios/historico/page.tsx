'use client';

import { RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ErroApi, api, type EstacaoApi, type HistoricoClimatico } from '@/lib/api';

type Granularidade = HistoricoClimatico['granularidade'];

const CORES_GRAFICO = ['#0891b2', '#65a30d', '#ea580c', '#7c3aed', '#db2777', '#0284c7'];

function dataLocal(data: Date) {
  const ajuste = data.getTimezoneOffset() * 60_000;
  return new Date(data.getTime() - ajuste).toISOString().slice(0, 10);
}

async function carregarEstacoes(signal: AbortSignal): Promise<EstacaoApi[]> {
  const tamanho = 200;
  const primeiras = await api<{ itens: EstacaoApi[]; total: number }>(
    `/estacoes?pagina=1&tamanho=${tamanho}`,
    { signal },
  );
  const estacoes = [...primeiras.itens];
  const paginas = Math.ceil(primeiras.total / tamanho);

  for (let pagina = 2; pagina <= paginas; pagina += 1) {
    const resposta = await api<{ itens: EstacaoApi[] }>(
      `/estacoes?pagina=${pagina}&tamanho=${tamanho}`,
      { signal },
    );
    estacoes.push(...resposta.itens);
  }

  return estacoes;
}

function rotuloPeriodo(periodo: string, granularidade: Granularidade) {
  const data = new Date(periodo);
  return granularidade === 'dia'
    ? data.toLocaleDateString('pt-BR', { timeZone: 'UTC' })
    : data.toLocaleString('pt-BR', {
        timeZone: 'UTC',
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
      });
}

function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', {
    maximumFractionDigits: 2,
    minimumFractionDigits: 2,
  });
}

export default function RelatoriosPage() {
  const router = useRouter();
  const usuario = useUsuario();
  const [estacoes, setEstacoes] = useState<EstacaoApi[]>([]);
  const [estacoesSelecionadas, setEstacoesSelecionadas] = useState<string[]>([]);
  const [de, setDe] = useState(() => dataLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [ate, setAte] = useState(() => dataLocal(new Date()));
  const [granularidade, setGranularidade] = useState<Granularidade>('dia');
  const [relatorio, setRelatorio] = useState<HistoricoClimatico | null>(null);
  const [carregandoEstacoes, setCarregandoEstacoes] = useState(true);
  const [carregando, setCarregando] = useState(false);
  const [erroEstacoes, setErroEstacoes] = useState<string | null>(null);
  const [erroRelatorio, setErroRelatorio] = useState<string | null>(null);
  const [tentativaEstacoes, setTentativaEstacoes] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();

    carregarEstacoes(controlador.signal)
      .then((resultado) => {
        setEstacoes(resultado);
        setEstacoesSelecionadas(resultado.map((estacao) => estacao.id));
      })
      .catch((erro: unknown) => {
        if (erro instanceof DOMException && erro.name === 'AbortError') return;
        if (erro instanceof ErroApi && erro.status === 401) {
          router.replace('/login');
          return;
        }
        setErroEstacoes('Não foi possível carregar as estações. Tente novamente.');
      })
      .finally(() => {
        if (!controlador.signal.aborted) setCarregandoEstacoes(false);
      });

    return () => controlador.abort();
  }, [router, tentativaEstacoes]);

  const gerarRelatorio = useCallback(async () => {
    setErroRelatorio(null);
    setRelatorio(null);

    if (!de || !ate) {
      setErroRelatorio('Informe as datas inicial e final.');
      return;
    }
    if (de > ate) {
      setErroRelatorio('A data inicial deve ser anterior ou igual à data final.');
      return;
    }
    if (estacoesSelecionadas.length === 0) {
      setErroRelatorio('Selecione pelo menos uma estação.');
      return;
    }

    const query = new URLSearchParams({ de, ate, granularidade });
    estacoesSelecionadas.forEach((id) => query.append('estacaoIds', id));
    const controlador = new AbortController();
    setCarregando(true);

    try {
      const resultado = await api<HistoricoClimatico>(
        `/relatorios/historico-climatico?${query.toString()}`,
        { signal: controlador.signal },
      );
      setRelatorio(resultado);
    } catch (erro: unknown) {
      if (erro instanceof DOMException && erro.name === 'AbortError') return;
      if (erro instanceof ErroApi && erro.status === 401) {
        router.replace('/login');
        return;
      }
      setErroRelatorio(
        erro instanceof Error
          ? erro.message
          : 'Não foi possível gerar o relatório. Tente novamente.',
      );
    } finally {
      setCarregando(false);
    }
  }, [ate, de, estacoesSelecionadas, granularidade, router]);

  const parametros = useMemo(
    () => [
      ...new Map(
        (relatorio?.estacoes ?? []).flatMap((estacao) =>
          estacao.parametros.map((parametro) => [parametro.id, parametro] as const),
        ),
      ).values(),
    ],
    [relatorio],
  );

  function alternarEstacao(id: string) {
    setEstacoesSelecionadas((selecionadas) =>
      selecionadas.includes(id)
        ? selecionadas.filter((selecionada) => selecionada !== id)
        : [...selecionadas, id],
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="Relatório de histórico climático"
        description={`Análise de variáveis climáticas por período e estação${usuario?.licitacao ? ` · ${usuario.licitacao.codigoIdentificador}` : ''}.`}
      />

      <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label="Filtros do relatório">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CampoData label="Data inicial" value={de} onChange={setDe} />
          <CampoData label="Data final" value={ate} onChange={setAte} />
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="granularidade" className="font-mono text-[10px] uppercase text-muted-foreground">
              Granularidade
            </label>
            <Select
              id="granularidade"
              value={granularidade}
              onChange={(event) => setGranularidade(event.target.value as Granularidade)}
            >
              <option value="hora">Por hora</option>
              <option value="dia">Por dia</option>
            </Select>
          </div>
        </div>

        <div>
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h2 className="font-display text-sm font-semibold">Estações</h2>
              <p className="text-xs text-muted-foreground">
                {estacoesSelecionadas.length} de {estacoes.length} selecionada(s)
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEstacoesSelecionadas(estacoes.map((estacao) => estacao.id))}
                disabled={carregandoEstacoes || estacoes.length === 0}
              >
                Todas
              </Button>
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={() => setEstacoesSelecionadas([])}
                disabled={carregandoEstacoes || estacoes.length === 0}
              >
                Nenhuma
              </Button>
            </div>
          </div>

          {carregandoEstacoes ? (
            <p className="py-3 text-sm text-muted-foreground" role="status">Carregando estações...</p>
          ) : erroEstacoes ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-destructive" role="alert">
              <p>{erroEstacoes}</p>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => {
                  setCarregandoEstacoes(true);
                  setErroEstacoes(null);
                  setTentativaEstacoes((valor) => valor + 1);
                }}
              >
                <RefreshCw /> Tentar novamente
              </Button>
            </div>
          ) : estacoes.length === 0 ? (
            <p className="py-3 text-sm text-muted-foreground">Nenhuma estação disponível para seu perfil.</p>
          ) : (
            <div className="grid max-h-48 gap-2 overflow-y-auto rounded-md border border-border p-3 sm:grid-cols-2 lg:grid-cols-3">
              {estacoes.map((estacao) => (
                <label key={estacao.id} className="flex min-w-0 items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={estacoesSelecionadas.includes(estacao.id)}
                    onChange={() => alternarEstacao(estacao.id)}
                    className="size-4 shrink-0 accent-primary"
                  />
                  <span className="truncate" title={estacao.nome}>{estacao.nome}</span>
                </label>
              ))}
            </div>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="button"
            onClick={() => void gerarRelatorio()}
            disabled={carregando || carregandoEstacoes || Boolean(erroEstacoes) || estacoes.length === 0}
          >
            {carregando ? 'Gerando relatório...' : 'Gerar relatório'}
          </Button>
          {erroRelatorio && <p className="text-sm text-destructive" role="alert">{erroRelatorio}</p>}
        </div>
      </section>

      {carregando && (
        <div className="grid min-h-36 place-items-center rounded-lg border border-border bg-card text-sm text-muted-foreground" role="status">
          Carregando dados climáticos...
        </div>
      )}

      {relatorio && !carregando && relatorio.estacoes.every((estacao) => estacao.parametros.length === 0) && (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <h2 className="font-display text-sm font-semibold">Nenhum dado encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Não há leituras para as estações e o período selecionados.</p>
        </div>
      )}

      {relatorio && !carregando && parametros.length > 0 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Período: {new Date(relatorio.de).toLocaleDateString('pt-BR', { timeZone: 'UTC' })} a{' '}
            {new Date(relatorio.ate).toLocaleDateString('pt-BR', { timeZone: 'UTC' })}
            {' · '}{relatorio.granularidade === 'dia' ? 'Agrupado por dia' : 'Agrupado por hora'}
            {' · '}{estacoesSelecionadas.length} estação(ões)
          </p>

          <section className="space-y-3" aria-label="Gráficos do relatório">
            <h2 className="font-display text-base font-semibold">Evolução por parâmetro</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {parametros.map((parametro) => (
                <GraficoParametro
                  key={parametro.id}
                  parametro={parametro}
                  estacoes={relatorio.estacoes}
                  granularidade={relatorio.granularidade}
                />
              ))}
            </div>
          </section>

          <section className="space-y-3" aria-label="Tabela de totalizadores">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">Totalizadores do período</h2>
                <p className="text-sm text-muted-foreground">
                  O valor consolidado segue a agregação configurada para cada parâmetro.
                </p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {relatorio.estacoes.reduce((total, estacao) => total + estacao.parametros.length, 0).toLocaleString('pt-BR')} parâmetros
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[980px] text-left text-sm">
                <thead className="bg-muted/50 font-mono text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Estação</th>
                    <th className="px-3 py-2">Parâmetro</th>
                    <th className="px-3 py-2">Agregação</th>
                    <th className="px-3 py-2 text-right">Consolidado</th>
                    <th className="px-3 py-2 text-right">Soma</th>
                    <th className="px-3 py-2 text-right">Média</th>
                    <th className="px-3 py-2 text-right">Mínimo</th>
                    <th className="px-3 py-2 text-right">Máximo</th>
                    <th className="px-3 py-2 text-right">Leituras</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {relatorio.estacoes.flatMap((estacao) =>
                    estacao.parametros.map((parametro) => (
                      <tr key={`${estacao.id}-${parametro.id}`} className="hover:bg-muted/20">
                        <td className="px-3 py-2">{estacao.nome}</td>
                        <td className="px-3 py-2">{parametro.nome}</td>
                        <td className="px-3 py-2">{parametro.agregacao === 'SOMA' ? 'Soma' : 'Média'}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarValor(parametro.totalPeriodo.valor)} {parametro.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarValor(parametro.totalPeriodo.soma)} {parametro.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarValor(parametro.totalPeriodo.media)} {parametro.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarValor(parametro.totalPeriodo.minimo)} {parametro.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{formatarValor(parametro.totalPeriodo.maximo)} {parametro.unidade}</td>
                        <td className="px-3 py-2 text-right tabular-nums">{parametro.totalPeriodo.leituras.toLocaleString('pt-BR')}</td>
                      </tr>
                    )),
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}

function CampoData({
  label,
  value,
  onChange,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
}) {
  const id = label === 'Data inicial' ? 'data-inicial' : 'data-final';
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="font-mono text-[10px] uppercase text-muted-foreground">{label}</label>
      <input
        id={id}
        type="date"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function GraficoParametro({
  parametro,
  estacoes,
  granularidade,
}: {
  parametro: { id: string; nome: string; unidade: string; agregacao: 'SOMA' | 'MEDIA' };
  estacoes: HistoricoClimatico['estacoes'];
  granularidade: Granularidade;
}) {
  const dados = estacoes.flatMap((estacao) => {
    const dadosParametro = estacao.parametros.find((item) => item.id === parametro.id);
    return dadosParametro ? [{ estacao, parametro: dadosParametro }] : [];
  });
  const periodos = [...new Set(dados.flatMap(({ parametro: item }) => item.periodos.map((ponto) => ponto.periodo ?? '')))]
    .filter(Boolean)
    .sort();
  const valores = dados.flatMap(({ parametro: item }) => item.periodos.map((ponto) => ponto.valor));
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;
  const ticks = [...new Set([0, Math.floor((periodos.length - 1) / 2), periodos.length - 1])]
    .filter((indice) => periodos[indice] !== undefined);

  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="border-b border-border px-4 py-3">
        <h3 className="font-display text-sm font-semibold">{parametro.nome}</h3>
        <p className="text-xs text-muted-foreground">
          {parametro.agregacao === 'SOMA' ? 'Soma por período' : 'Média por período'} · {parametro.unidade}
        </p>
      </div>
      <div className="px-4 py-3">
        <svg
          viewBox="0 0 100 48"
          preserveAspectRatio="none"
          className="h-40 w-full"
          role="img"
          aria-label={`Gráfico de ${parametro.nome}`}
        >
          {[8, 24, 40].map((y) => (
            <line key={y} x1="8" x2="92" y1={y} y2={y} stroke="currentColor" strokeOpacity=".12" vectorEffect="non-scaling-stroke" />
          ))}
          {dados.map(({ estacao, parametro: item }, indice) => {
            const pontosPorPeriodo = new Map(item.periodos.map((ponto) => [ponto.periodo, ponto.valor]));
            const pontos = periodos.flatMap((periodo, periodoIndice) => {
              const valor = pontosPorPeriodo.get(periodo);
              return valor === undefined
                ? []
                : [{
                    x: 8 + (periodoIndice / Math.max(periodos.length - 1, 1)) * 84,
                    y: 40 - ((valor - minimo) / amplitude) * 32,
                  }];
            });
            const cor = CORES_GRAFICO[indice % CORES_GRAFICO.length];
            return (
              <g key={estacao.id}>
                <polyline
                  points={pontos.map((ponto) => `${ponto.x},${ponto.y}`).join(' ')}
                  fill="none"
                  stroke={cor}
                  strokeWidth="1.6"
                  vectorEffect="non-scaling-stroke"
                />
                {pontos.map((ponto, pontoIndice) => (
                  <circle key={`${estacao.id}-${pontoIndice}`} cx={ponto.x} cy={ponto.y} r=".8" fill={cor} />
                ))}
              </g>
            );
          })}
          {ticks.map((indice) => (
            <text
              key={indice}
              x={8 + (indice / Math.max(periodos.length - 1, 1)) * 84}
              y="47"
              textAnchor="middle"
              fill="currentColor"
              fontSize="3"
            >
              {rotuloPeriodo(periodos[indice], granularidade)}
            </text>
          ))}
        </svg>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {dados.map(({ estacao }, indice) => (
            <span key={estacao.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: CORES_GRAFICO[indice % CORES_GRAFICO.length] }} />
              {estacao.nome}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
