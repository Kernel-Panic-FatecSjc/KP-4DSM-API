'use client';

import { useEffect, useState } from 'react';
import { ErroApi, api, type DashboardDados, type DashboardSerie } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;
const SETE_DIAS_EM_MS = 7 * UM_DIA_EM_MS;

type Periodo = '24h' | '7d' | 'mes' | 'customizado';

type TipoGrafico = 'chuva' | 'vento' | 'temperatura' | 'umidade';

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

function obterPeriodo(periodo: Periodo) {
  const agora = new Date();

  switch (periodo) {
    case '24h':
      return {
        de: formatoDataLocal(new Date(agora.getTime() - UM_DIA_EM_MS)),
        ate: formatoDataLocal(agora),
      };

    case '7d':
      return {
        de: formatoDataLocal(new Date(agora.getTime() - SETE_DIAS_EM_MS)),
        ate: formatoDataLocal(agora),
      };

    case 'mes': {
      const inicioMes = new Date(
        agora.getFullYear(),
        agora.getMonth(),
        1,
        0,
        0,
        0,
        0,
      );

      return {
        de: formatoDataLocal(inicioMes),
        ate: formatoDataLocal(agora),
      };
    }

    case 'customizado':
      return {
        de: formatoDataLocal(new Date(agora.getTime() - UM_DIA_EM_MS)),
        ate: formatoDataLocal(agora),
      };
  }
}

function normalizarTexto(texto: string) {
  return texto
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function identificarTipoGrafico(nome: string): TipoGrafico | null {
  const valor = normalizarTexto(nome);

  if (valor.includes('chuva') || valor.includes('precipit')) {
    return 'chuva';
  }

  if (
    valor.includes('rajada') ||
    valor.includes('gust') ||
    valor.includes('vento')
  ) {
    return 'vento';
  }

  if (
    valor.includes('temperatura') ||
    valor.includes('temp')
  ) {
    return 'temperatura';
  }

  if (
    valor.includes('umidade') ||
    valor.includes('humidade') ||
    valor.includes('humidity')
  ) {
    return 'umidade';
  }

  return null;
}

function tituloTipo(tipo: TipoGrafico) {
  switch (tipo) {
    case 'chuva':
      return 'Chuva acumulada';
    case 'vento':
      return 'Rajadas de vento';
    case 'temperatura':
      return 'Temperatura';
    case 'umidade':
      return 'Umidade';
  }
}

function obterPontosChuvaAcumulada(serie: DashboardSerie) {
  let acumulado = 0;

  return serie.pontos.map((ponto) => {
    acumulado += ponto.valor;

    return {
      ...ponto,
      valor: acumulado,
    };
  });
}

function obterValorAtual(serie: DashboardSerie) {
  return serie.pontos.at(-1)?.valor ?? null;
}

export default function DashboardPage() {
  const router = useRouter();
  const agora = new Date();
  const [periodo, setPeriodo] = useState<Periodo>('24h');
  const [estacaoId, setEstacaoId] = useState('');
  const [de, setDe] = useState(formatoDataLocal(new Date(agora.getTime() - UM_DIA_EM_MS)));
  const [ate, setAte] = useState(formatoDataLocal(agora));
  const [dados, setDados] = useState<DashboardDados | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [tentativa, setTentativa] = useState(0);

  useEffect(() => {
    const controlador = new AbortController();

    api<DashboardDados>(`/dashboard?${montarQuery(estacaoId, de, ate)}`, {
      signal: controlador.signal,
    })
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

  function alterarPeriodo(novoPeriodo: Periodo) {
    setPeriodo(novoPeriodo);
    setCarregando(true);
    setErro(null);

    if (novoPeriodo !== 'customizado') {
      const intervalo = obterPeriodo(novoPeriodo);
      setDe(intervalo.de);
      setAte(intervalo.ate);
    }
  }

  const seriesMeteorologicas = dados
    ? dados.series
        .map((serie) => ({
          ...serie,
          tipo: identificarTipoGrafico(serie.nome),
        }))
        .filter(
          (
            serie,
          ): serie is DashboardSerie & {
            tipo: TipoGrafico;
          } => serie.tipo !== null,
        )
    : [];

  const tiposGrafico: TipoGrafico[] = [
    'chuva',
    'vento',
    'temperatura',
    'umidade',
  ];

  const seriesPorTipo = tiposGrafico.map((tipo) => ({
    tipo,
    series: seriesMeteorologicas.filter((serie) => serie.tipo === tipo),
  }));

  return (
    <div className="space-y-5">
      <PageHeading
        title="Dashboard"
        description="Acompanhe as leituras das estações no período selecionado."
      />

      <section
        className="rise delay-1 grid gap-2.5 sm:grid-cols-3"
        aria-label="Filtros do dashboard"
      >
        <div className="flex flex-col gap-1">
          <label
            htmlFor="periodo"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Período
          </label>

          <Select
            id="periodo"
            value={periodo}
            onChange={(event) =>
              alterarPeriodo(event.target.value as Periodo)
            }
          >
            <option value="24h">Últimas 24 horas</option>
            <option value="7d">Últimos 7 dias</option>
            <option value="mes">Este mês</option>
            <option value="customizado">Intervalo personalizado</option>
          </Select>
        </div>

        <div className="flex flex-col gap-1">
          <label
            htmlFor="estacao"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Estação
          </label>

          <Select
            id="estacao"
            value={estacaoId}
            onChange={(event) => {
              setEstacaoId(event.target.value);
              setCarregando(true);
              setErro(null);
            }}
          >
            <option value="">Todas as estações</option>
            {dados?.estacoes.map((estacao) => (
              <option key={estacao.id} value={estacao.id}>
                {estacao.nome}
              </option>
            ))}
          </Select>
        </div>

        <CampoData
          label="De"
          value={de}
          onChange={(value) => {
            setDe(value);
            setCarregando(true);
            setErro(null);
          }}
        />

        <CampoData
          label="Até"
          value={ate}
          onChange={(value) => {
            setAte(value);
            setCarregando(true);
            setErro(null);
          }}
        />
      </section>

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{erro}</p>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCarregando(true);
              setErro(null);
              setTentativa((valor) => valor + 1);
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      {carregando && !dados ? (
        <div className="grid min-h-64 place-items-center text-sm text-muted-foreground">
          Carregando dados reais...
        </div>
      ) : dados ? (
        <>
          <section
            className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4"
            aria-label="Indicadores"
          >
            <Indicador
              titulo="Estações ativas"
              valor={dados.indicadores.estacoesAtivas}
              detalhe="com leituras no período"
            />

            <Indicador
              titulo="Leituras"
              valor={dados.indicadores.leituras}
              detalhe="registros processados"
            />

            <Indicador
              titulo="Média geral"
              valor={
                dados.indicadores.media === null
                  ? '—'
                  : dados.indicadores.media.toFixed(1)
              }
              detalhe="entre os parâmetros"
            />

            <Indicador
              titulo="Alertas abertos"
              valor={dados.indicadores.alarmesAbertos}
              detalhe="no período selecionado"
            />
          </section>

          {seriesMeteorologicas.length === 0 ? (
            <div className="rise delay-2 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
              <h2 className="font-display text-sm font-semibold">
                Nenhum dado meteorológico encontrado
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Não existem dados de chuva, vento, temperatura ou umidade para
                os filtros selecionados.
              </p>
            </div>
          ) : (
            <>
              <section
                aria-label="Dados atuais"
                className="space-y-3"
              >
                <div>
                  <h2 className="font-display text-base font-semibold">
                    Dados atuais
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Última leitura disponível para cada parâmetro.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {seriesPorTipo.map(({ tipo, series }) => {
                    const serie = series[0];

                    if (!serie) {
                      return (
                        <IndicadorAtual
                          key={tipo}
                          titulo={tituloTipo(tipo)}
                          valor="—"
                          unidade=""
                          detalhe="Sem dados disponíveis"
                        />
                      );
                    }

                    let valorAtual = obterValorAtual(serie);

                    if (tipo === 'chuva') {
                      const pontosAcumulados =
                        obterPontosChuvaAcumulada(serie);

                      valorAtual =
                        pontosAcumulados.at(-1)?.valor ?? null;
                    }

                    return (
                      <IndicadorAtual
                        key={tipo}
                        titulo={tituloTipo(tipo)}
                        valor={
                          valorAtual === null
                            ? '—'
                            : valorAtual.toFixed(1)
                        }
                        unidade={serie.unidade}
                        detalhe={`${serie.estacaoNome} · última leitura`}
                      />
                    );
                  })}
                </div>
              </section>

              <section
                aria-label="Histórico dos dados meteorológicos"
                className="space-y-3"
              >
                <div>
                  <h2 className="font-display text-base font-semibold">
                    Histórico
                  </h2>

                  <p className="text-sm text-muted-foreground">
                    Evolução dos dados no período selecionado.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {seriesPorTipo.map(({ tipo, series }) => {
                    if (series.length === 0) {
                      return (
                        <GraficoSemDados
                          key={tipo}
                          titulo={tituloTipo(tipo)}
                        />
                      );
                    }

                    return series.map((serie) => (
                      <GraficoMeteorologico
                        key={`${tipo}-${serie.estacaoId}-${serie.parametroId}`}
                        serie={serie}
                        tipo={tipo}
                      />
                    ));
                  })}
                </div>
              </section>
            </>
          )}
        </>
      ) : null}
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
  return (
    <div className="flex flex-col gap-1">
      <label className="font-mono text-[10px] uppercase text-muted-foreground">
        {label}
      </label>

      <input
        type="datetime-local"
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-9 rounded-md border border-input bg-card px-3 font-mono text-[11px] text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      />
    </div>
  );
}

function Indicador({
  titulo,
  valor,
  detalhe,
}: {
  titulo: string;
  valor: string | number;
  detalhe: string;
}) {
  return (
    <article className="rise delay-2 rounded-lg border border-border bg-card px-4 py-4">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">
        {titulo}
      </p>

      <p className="mt-2 font-display text-2xl font-semibold">
        {valor}
      </p>

      <p className="mt-1 text-xs text-muted-foreground">
        {detalhe}
      </p>
    </article>
  );
}

function IndicadorAtual({
  titulo,
  valor,
  unidade,
  detalhe,
}: {
  titulo: string;
  valor: string;
  unidade: string;
  detalhe: string;
}) {
  return (
    <article className="rise delay-2 rounded-lg border border-border bg-card px-4 py-4">
      <p className="font-mono text-[10px] uppercase text-muted-foreground">
        {titulo}
      </p>

      <div className="mt-2 flex items-baseline gap-1">
        <strong className="font-display text-2xl font-semibold">
          {valor}
        </strong>

        {unidade && (
          <span className="font-mono text-xs text-muted-foreground">
            {unidade}
          </span>
        )}
      </div>

      <p className="mt-1 text-xs text-muted-foreground">
        {detalhe}
      </p>
    </article>
  );
}

function GraficoSemDados({
  titulo,
}: {
  titulo: string;
}) {
  return (
    <article className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
      <h3 className="font-display text-sm font-semibold">
        {titulo}
      </h3>

      <p className="mt-1 text-sm text-muted-foreground">
        Nenhum dado disponível para o período selecionado.
      </p>
    </article>
  );
}

function GraficoMeteorologico({
  serie,
  tipo,
}: {
  serie: DashboardSerie;
  tipo: TipoGrafico;
}) {
  const pontos =
    tipo === 'chuva'
      ? obterPontosChuvaAcumulada(serie)
      : serie.pontos;

  if (pontos.length === 0) {
    return <GraficoSemDados titulo={tituloTipo(tipo)} />;
  }

  const valores = pontos.map((ponto) => ponto.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;

  const pontosGrafico = pontos
    .map((ponto, indice) => {
      const x =
        (indice / Math.max(pontos.length - 1, 1)) * 100;

      const y =
        92 - ((ponto.valor - minimo) / amplitude) * 76;

      return `${x},${y}`;
    })
    .join(' ');

  const valorAtual = pontos.at(-1)?.valor ?? null;

  return (
    <article className="rise delay-3 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">
            {tituloTipo(tipo)}
          </h2>

          <p className="font-mono text-[10px] text-muted-foreground">
            {serie.estacaoNome} · {pontos.length} pontos
          </p>
        </div>

        <span className="font-mono text-xs text-aqua">
          {serie.unidade}
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between">
          <strong className="font-display text-xl">
            {valorAtual === null
              ? '—'
              : valorAtual.toFixed(1)}
          </strong>

          <span className="font-mono text-[10px] text-muted-foreground">
            {tipo === 'chuva'
              ? 'acumulado no período'
              : 'última leitura'}
          </span>
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="mt-4 h-40 w-full"
          role="img"
          aria-label={`Gráfico histórico de ${tituloTipo(tipo)}`}
        >
          <path
            d="M0 92H100 M0 54H100 M0 16H100"
            stroke="currentColor"
            strokeOpacity=".1"
            vectorEffect="non-scaling-stroke"
          />

          <polyline
            points={pontosGrafico}
            fill="none"
            stroke="currentColor"
            className="text-aqua"
            strokeWidth="1.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </article>
  );
}

function GraficoSerie({
  serie,
}: {
  serie: DashboardSerie;
}) {
  const valores = serie.pontos.map((ponto) => ponto.valor);
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;

  const pontos = serie.pontos
    .map((ponto, indice) => {
      const x =
        (indice / Math.max(serie.pontos.length - 1, 1)) * 100;

      const y =
        92 - ((ponto.valor - minimo) / amplitude) * 76;

      return `${x},${y}`;
    })
    .join(' ');

  return (
    <article className="rise delay-3 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">
            {serie.nome}
          </h2>

          <p className="font-mono text-[10px] text-muted-foreground">
            {serie.estacaoNome} · {serie.pontos.length} pontos
          </p>
        </div>

        <span className="font-mono text-xs text-aqua">
          {serie.unidade}
        </span>
      </div>

      <div className="px-4 py-4">
        <div className="flex items-baseline justify-between">
          <strong className="font-display text-xl">
            {serie.pontos.at(-1)?.valor.toFixed(1)}
          </strong>

          <span className="font-mono text-[10px] text-muted-foreground">
            última leitura
          </span>
        </div>

        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="mt-4 h-40 w-full"
          role="img"
          aria-label={`Gráfico de ${serie.nome}`}
        >
          <path
            d="M0 92H100 M0 54H100 M0 16H100"
            stroke="currentColor"
            strokeOpacity=".1"
            vectorEffect="non-scaling-stroke"
          />

          <polyline
            points={pontos}
            fill="none"
            stroke="currentColor"
            className="text-aqua"
            strokeWidth="1.8"
            vectorEffect="non-scaling-stroke"
          />
        </svg>
      </div>
    </article>
  );
}
