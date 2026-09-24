'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ErroApi,
  api,
  type DashboardDados,
  type DashboardSerie,
} from '@/lib/api';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';

const UM_DIA_EM_MS = 24 * 60 * 60 * 1000;
const SETE_DIAS_EM_MS = 7 * UM_DIA_EM_MS;

type Periodo = '24h' | '7d' | 'mes' | 'customizado';

type TipoGrafico =
  | 'chuva'
  | 'vento'
  | 'temperatura'
  | 'umidade';

function formatoDataLocal(data: Date) {
  const ajuste = data.getTimezoneOffset() * 60000;

  return new Date(data.getTime() - ajuste)
    .toISOString()
    .slice(0, 16);
}

function montarQuery(
  estacaoId: string,
  de: string,
  ate: string,
) {
  const query = new URLSearchParams();

  if (estacaoId) {
    query.set('estacaoId', estacaoId);
  }

  if (de) {
    query.set('de', new Date(de).toISOString());
  }

  if (ate) {
    query.set('ate', new Date(ate).toISOString());
  }

  return query.toString();
}

function obterPeriodo(periodo: Periodo) {
  const agora = new Date();

  switch (periodo) {
    case '24h':
      return {
        de: formatoDataLocal(
          new Date(agora.getTime() - UM_DIA_EM_MS),
        ),
        ate: formatoDataLocal(agora),
      };

    case '7d':
      return {
        de: formatoDataLocal(
          new Date(agora.getTime() - SETE_DIAS_EM_MS),
        ),
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
        de: formatoDataLocal(
          new Date(agora.getTime() - UM_DIA_EM_MS),
        ),
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

function identificarTipoGrafico(
  nome: string,
): TipoGrafico | null {
  const valor = normalizarTexto(nome);

  if (
    valor.includes('chuva') ||
    valor.includes('precipit')
  ) {
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

/**
 * Retorna o último valor da série.
 *
 * IMPORTANTE:
 * Para chuva, a API já retorna o valor acumulado.
 * Portanto, NÃO devemos somar os pontos novamente no frontend.
 */
function obterValorAtual(serie: DashboardSerie) {
  return serie.pontos.at(-1)?.valor ?? null;
}

/* =========================
   CÁLCULOS ESTATÍSTICOS
   ========================= */

function calcularMediaMovel(
  valores: number[],
  janela = 5,
) {
  if (valores.length === 0) {
    return [];
  }

  return valores.map((_, indice) => {
    const inicio = Math.max(0, indice - janela + 1);
    const valoresJanela = valores.slice(
      inicio,
      indice + 1,
    );

    return (
      valoresJanela.reduce(
        (total, valor) => total + valor,
        0,
      ) / valoresJanela.length
    );
  });
}

function calcularMaximo(valores: number[]) {
  if (valores.length === 0) {
    return null;
  }

  return valores.reduce(
    (maximo, valor) => Math.max(maximo, valor),
    valores[0],
  );
}

function calcularMinimo(valores: number[]) {
  if (valores.length === 0) {
    return null;
  }

  return valores.reduce(
    (minimo, valor) => Math.min(minimo, valor),
    valores[0],
  );
}

function calcularDesvioPadrao(valores: number[]) {
  if (valores.length === 0) {
    return null;
  }

  const media =
    valores.reduce(
      (total, valor) => total + valor,
      0,
    ) / valores.length;

  const variancia =
    valores.reduce(
      (total, valor) =>
        total + Math.pow(valor - media, 2),
      0,
    ) / valores.length;

  return Math.sqrt(variancia);
}

export default function DashboardPage() {
  const router = useRouter();

  const agora = new Date();

  const [periodo, setPeriodo] =
    useState<Periodo>('24h');

  const [estacaoId, setEstacaoId] = useState('');

  const [de, setDe] = useState(
    formatoDataLocal(
      new Date(agora.getTime() - UM_DIA_EM_MS),
    ),
  );

  const [ate, setAte] = useState(
    formatoDataLocal(agora),
  );

  const [dados, setDados] =
    useState<DashboardDados | null>(null);

  const [tentativa, setTentativa] =
    useState(0);

  const chaveRequisicao = `${estacaoId}|${de}|${ate}|${tentativa}`;

  const [chaveCarregada, setChaveCarregada] =
    useState<string | null>(null);

  const carregando = chaveCarregada !== chaveRequisicao;

  const [erro, setErro] =
    useState<string | null>(null);

  useEffect(() => {
    const controlador = new AbortController();

    api<DashboardDados>(
      `/dashboard?${montarQuery(
        estacaoId,
        de,
        ate,
      )}`,
      {
        signal: controlador.signal,
      },
    )
      .then((resposta) => {
        setDados(resposta);
        setErro(null);

        if (
          estacaoId &&
          !resposta.estacoes.some(
            (estacao) =>
              estacao.id === estacaoId,
          )
        ) {
          setEstacaoId('');
        }
      })
      .catch((erroCapturado: unknown) => {
        if (
          erroCapturado instanceof DOMException &&
          erroCapturado.name === 'AbortError'
        ) {
          return;
        }

        if (
          erroCapturado instanceof ErroApi &&
          erroCapturado.status === 401
        ) {
          router.replace('/login');
          return;
        }

        setErro(
          'Não foi possível carregar os dados do dashboard. Tente novamente.',
        );
      })
      .finally(() => {
        if (!controlador.signal.aborted) {
          setChaveCarregada(chaveRequisicao);
        }
      });

    return () => controlador.abort();
  }, [
    ate,
    chaveRequisicao,
    de,
    estacaoId,
    router,
  ]);

  function alterarPeriodo(
    novoPeriodo: Periodo,
  ) {
    setPeriodo(novoPeriodo);
    setErro(null);

    if (novoPeriodo !== 'customizado') {
      const intervalo =
        obterPeriodo(novoPeriodo);

      setDe(intervalo.de);
      setAte(intervalo.ate);
    }
  }

  const seriesMeteorologicas = dados
    ? dados.series
        .map((serie) => ({
          ...serie,
          tipo: identificarTipoGrafico(
            serie.nome,
          ),
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

  const seriesPorTipo = tiposGrafico.map(
    (tipo) => ({
      tipo,
      series: seriesMeteorologicas.filter(
        (serie) => serie.tipo === tipo,
      ),
    }),
  );

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
              alterarPeriodo(
                event.target.value as Periodo,
              )
            }
          >
            <option value="24h">
              Últimas 24 horas
            </option>

            <option value="7d">
              Últimos 7 dias
            </option>

            <option value="mes">
              Este mês
            </option>

            <option value="customizado">
              Intervalo personalizado
            </option>
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
              setErro(null);
            }}
          >
            <option value="">
              Todas as estações
            </option>

            {dados?.estacoes.map(
              (estacao) => (
                <option
                  key={estacao.id}
                  value={estacao.id}
                >
                  {estacao.nome}
                </option>
              ),
            )}
          </Select>
        </div>

        <CampoData
          label="De"
          value={de}
          onChange={(value) => {
            setDe(value);
            setErro(null);
          }}
        />

        <CampoData
          label="Até"
          value={ate}
          onChange={(value) => {
            setAte(value);
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
              setErro(null);
              setTentativa(
                (valor) => valor + 1,
              );
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
              valor={
                dados.indicadores
                  .estacoesAtivas
              }
              detalhe="com leituras no período"
            />

            <Indicador
              titulo="Leituras"
              valor={
                dados.indicadores.leituras
              }
              detalhe="registros processados"
            />

            <Indicador
              titulo="Média geral"
              valor={
                dados.indicadores.media ===
                null
                  ? '—'
                  : dados.indicadores.media.toFixed(
                      1,
                    )
              }
              detalhe="entre os parâmetros"
            />

            <Indicador
              titulo="Alertas abertos"
              valor={
                dados.indicadores
                  .alarmesAbertos
              }
              detalhe="no período selecionado"
            />
          </section>

          {seriesMeteorologicas.length ===
          0 ? (
            <div className="rise delay-2 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
              <h2 className="font-display text-sm font-semibold">
                Nenhum dado meteorológico
                encontrado
              </h2>

              <p className="mt-1 text-sm text-muted-foreground">
                Não existem dados de chuva,
                vento, temperatura ou umidade
                para os filtros selecionados.
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
                    Última leitura disponível
                    para cada parâmetro dentro
                    dos filtros selecionados.
                  </p>
                </div>

                <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {seriesPorTipo.map(
                    ({
                      tipo,
                      series,
                    }) => {
                      const serie =
                        series[0];

                      if (!serie) {
                        return (
                          <IndicadorAtual
                            key={tipo}
                            titulo={tituloTipo(
                              tipo,
                            )}
                            valor="—"
                            unidade=""
                            detalhe="Sem dados disponíveis"
                          />
                        );
                      }

                      /**
                       * IMPORTANTE:
                       * A chuva já vem acumulada
                       * pela API.
                       *
                       * Não somamos os pontos
                       * novamente.
                       */
                      const valorAtual =
                        obterValorAtual(
                          serie,
                        );

                      return (
                        <IndicadorAtual
                          key={tipo}
                          titulo={tituloTipo(
                            tipo,
                          )}
                          valor={
                            valorAtual ===
                            null
                              ? '—'
                              : valorAtual.toFixed(
                                  1,
                                )
                          }
                          unidade={
                            serie.unidade
                          }
                          detalhe={`${serie.estacaoNome} · última leitura`}
                        />
                      );
                    },
                  )}
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
                    Evolução dos dados no
                    período selecionado.
                  </p>
                </div>

                <div className="grid gap-4 lg:grid-cols-2">
                  {seriesPorTipo.map(
                    ({
                      tipo,
                      series,
                    }) => {
                      if (
                        series.length ===
                        0
                      ) {
                        return (
                          <GraficoSemDados
                            key={tipo}
                            titulo={tituloTipo(
                              tipo,
                            )}
                          />
                        );
                      }

                      return series.map(
                        (serie) => (
                          <GraficoMeteorologico
                            key={`${tipo}-${serie.estacaoId}-${serie.parametroId}`}
                            serie={serie}
                            tipo={tipo}
                          />
                        ),
                      );
                    },
                  )}
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
      <label
        className="font-mono text-[10px] uppercase text-muted-foreground"
      >
        {label}
      </label>

      <input
        type="datetime-local"
        value={value}
        onChange={(event) =>
          onChange(event.target.value)
        }
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
        Nenhum dado disponível para o
        período selecionado.
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
  /**
   * Todos os parâmetros, inclusive chuva,
   * usam exatamente os valores retornados
   * pela API.
   *
   * A chuva já é acumulada pela API.
   */
  const pontos = serie.pontos;

  const valores = pontos.map(
    (ponto) => ponto.valor,
  );

  const mediaMovel =
    calcularMediaMovel(valores);

  const maximo =
    calcularMaximo(valores);

  const minimo =
    calcularMinimo(valores);

  const desvioPadrao =
    calcularDesvioPadrao(valores);

  if (pontos.length === 0) {
    return (
      <GraficoSemDados
        titulo={tituloTipo(tipo)}
      />
    );
  }

  const minimoGrafico = minimo ?? 0;
  const maximoGrafico = maximo ?? 0;

  const amplitude =
    maximoGrafico - minimoGrafico || 1;

  const pontosGrafico = pontos
    .map((ponto, indice) => {
      const x =
        (indice /
          Math.max(
            pontos.length - 1,
            1,
          )) *
        100;

      const y =
        92 -
        ((ponto.valor -
          minimoGrafico) /
          amplitude) *
          76;

      return `${x},${y}`;
    })
    .join(' ');

  const valorAtual =
    pontos.at(-1)?.valor ?? null;

  return (
    <article className="rise delay-3 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h2 className="font-display text-sm font-semibold">
            {tituloTipo(tipo)}
          </h2>

          <p className="font-mono text-[10px] text-muted-foreground">
            {serie.estacaoNome} ·{' '}
            {pontos.length} pontos
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
          aria-label={`Gráfico histórico de ${tituloTipo(
            tipo,
          )}`}
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

        <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-4">
          <article className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">
              Máximo
            </p>

            <p className="mt-1 font-display text-sm font-semibold">
              {maximo === null
                ? '—'
                : maximo.toFixed(1)}
            </p>
          </article>

          <article className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">
              Mínimo
            </p>

            <p className="mt-1 font-display text-sm font-semibold">
              {minimo === null
                ? '—'
                : minimo.toFixed(1)}
            </p>
          </article>

          <article className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">
              Desvio padrão
            </p>

            <p className="mt-1 font-display text-sm font-semibold">
              {desvioPadrao === null
                ? '—'
                : desvioPadrao.toFixed(
                    1,
                  )}
            </p>
          </article>

          <article className="rounded-md border border-border bg-muted/20 px-3 py-2">
            <p className="font-mono text-[9px] uppercase text-muted-foreground">
              Média móvel
            </p>

            <p className="mt-1 font-display text-sm font-semibold">
              {mediaMovel.length === 0
                ? '—'
                : mediaMovel
                    .at(-1)!
                    .toFixed(1)}
            </p>
          </article>
        </div>
      </div>
    </article>
  );
}
