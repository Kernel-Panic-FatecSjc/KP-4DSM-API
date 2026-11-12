'use client';
import { ChevronLeft, ChevronRight, Download, Printer, RefreshCw } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { Button } from '@/components/ui/button';
import { Select } from '@/components/ui/select';
import { ErroApi, api, type DashboardDados, type EstacaoApi, type Paginado } from '@/lib/api';


type Granularidade = 'hora' | 'dia';


interface LeituraAgregada {
  chave: string;
  periodo: string;
  estacaoId: string;
  estacaoNome: string;
  parametroId: string;
  parametroNome: string;
  unidade: string;
  valores: number[];
}


interface LinhaRelatorio extends Omit<LeituraAgregada, 'valores'> {
  minimo: number;
  maximo: number;
  media: number;
  total: number;
  precipitacao: boolean;
}


const CORES_GRAFICO = ['#0891b2', '#65a30d', '#ea580c', '#7c3aed', '#db2777', '#0284c7'];
const LIMITE_LEITURAS_POR_ESTACAO = 5000;
const ITENS_POR_PAGINA = 5;


function dataLocal(data: Date) {
  const ajuste = data.getTimezoneOffset() * 60_000;
  return new Date(data.getTime() - ajuste).toISOString().slice(0, 10);
}


function normalizar(texto: string) {
  return texto.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
}


function ehPrecipitacao(nome: string) {
  const valor = normalizar(nome);
  return valor.includes('chuva') || valor.includes('precipit');
}


function chavePeriodo(timestamp: string, granularidade: Granularidade) {
  const data = new Date(timestamp);
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, '0');
  const dia = String(data.getDate()).padStart(2, '0');
  const dataBase = `${ano}-${mes}-${dia}`;


  if (granularidade === 'dia') return dataBase;
  return `${dataBase}T${String(data.getHours()).padStart(2, '0')}`;
}


function rotuloPeriodo(chave: string, granularidade: Granularidade) {
  if (granularidade === 'dia') {
    return new Date(`${chave}T12:00:00`).toLocaleDateString('pt-BR');
  }
  const data = new Date(`${chave}:00:00`);
  return data.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', hour: '2-digit' });
}


async function carregarEstacoes(signal: AbortSignal): Promise<EstacaoApi[]> {
  const tamanho = 200;
  const primeiras = await api<Paginado<EstacaoApi>>(`/estacoes?pagina=1&tamanho=${tamanho}`, { signal });
  const estacoes = [...primeiras.itens];
  const paginas = Math.ceil(primeiras.total / tamanho);


  for (let pagina = 2; pagina <= paginas; pagina += 1) {
    const resposta = await api<Paginado<EstacaoApi>>(`/estacoes?pagina=${pagina}&tamanho=${tamanho}`, { signal });
    estacoes.push(...resposta.itens);
  }


  return estacoes;
}


async function comConcorrenciaLimitada<T>(
  valores: T[],
  limite: number,
  executar: (valor: T) => Promise<void>,
) {
  let proximo = 0;
  const trabalhadores = Array.from({ length: Math.min(limite, valores.length) }, async () => {
    while (proximo < valores.length) {
      const indice = proximo;
      proximo += 1;
      await executar(valores[indice]);
    }
  });
  await Promise.all(trabalhadores);
}


export default function RelatoriosPage() {
  const router = useRouter();
  const usuario = useUsuario();
  const [estacoes, setEstacoes] = useState<EstacaoApi[]>([]);
  const [estacoesCarregando, setEstacoesCarregando] = useState(true);
  const [de, setDe] = useState(() => dataLocal(new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)));
  const [ate, setAte] = useState(() => dataLocal(new Date()));
  const [granularidade, setGranularidade] = useState<Granularidade>('dia');
  const [estacoesSelecionadas, setEstacoesSelecionadas] = useState<string[]>([]);
  const [linhas, setLinhas] = useState<LinhaRelatorio[]>([]);
  const [paginaAtual, setPaginaAtual] = useState(1);
  const [periodoGerado, setPeriodoGerado] = useState<{ de: string; ate: string } | null>(null);
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
        if (!controlador.signal.aborted) setEstacoesCarregando(false);
      });


    return () => controlador.abort();
  }, [router, tentativaEstacoes]);


  const gerarRelatorio = useCallback(async () => {
    setErroRelatorio(null);
    setLinhas([]);
    setPaginaAtual(1);
    setPeriodoGerado(null);


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


    const inicio = new Date(`${de}T00:00:00`).toISOString();
    const fim = new Date(`${ate}T23:59:59.999`).toISOString();
    const controlador = new AbortController();
    setCarregando(true);


    try {
      const resultados: DashboardDados[] = [];
      await comConcorrenciaLimitada(estacoesSelecionadas, 6, async (estacaoId) => {
        const query = new URLSearchParams({
          estacaoId,
          de: inicio,
          ate: fim,
          periodo: 'customizado',
        });
        const dados = await api<DashboardDados>(`/dashboard?${query}`, { signal: controlador.signal });
        if (dados.indicadores.leituras >= LIMITE_LEITURAS_POR_ESTACAO) {
          const estacao = estacoes.find((item) => item.id === estacaoId);
          throw new Error(
            `A estação ${estacao?.nome ?? estacaoId} atingiu o limite de ${LIMITE_LEITURAS_POR_ESTACAO.toLocaleString('pt-BR')} leituras por consulta. Reduza o período ou selecione menos estações.`,
          );
        }
        resultados.push(dados);
      });


      const agregados = new Map<string, LeituraAgregada>();
      for (const resultado of resultados) {
        for (const serie of resultado.series) {
          for (const ponto of serie.pontos) {
            const periodo = chavePeriodo(ponto.timestamp, granularidade);
            const chave = `${periodo}|${serie.estacaoId}|${serie.parametroId}`;
            const agregado = agregados.get(chave) ?? {
              chave,
              periodo,
              estacaoId: serie.estacaoId,
              estacaoNome: serie.estacaoNome,
              parametroId: serie.parametroId,
              parametroNome: serie.nome,
              unidade: serie.unidade,
              valores: [],
            };
            agregado.valores.push(ponto.valor);
            agregados.set(chave, agregado);
          }
        }
      }


      const resultadoLinhas = [...agregados.values()].map((item): LinhaRelatorio => {
        const { valores, ...dadosAgregados } = item;
        const total = valores.reduce((soma, valor) => soma + valor, 0);
        return {
          ...dadosAgregados,
          minimo: Math.min(...valores),
          maximo: Math.max(...valores),
          media: total / valores.length,
          total: ehPrecipitacao(item.parametroNome) ? valores.at(-1)! : total,
          precipitacao: ehPrecipitacao(item.parametroNome),
        };
      });
      resultadoLinhas.sort((a, b) =>
        a.periodo.localeCompare(b.periodo)
        || a.estacaoNome.localeCompare(b.estacaoNome, 'pt-BR')
        || a.parametroNome.localeCompare(b.parametroNome, 'pt-BR'),
      );
      setLinhas(resultadoLinhas);
      setPaginaAtual(1);
      setPeriodoGerado({ de, ate });
    } catch (erro: unknown) {
      controlador.abort();
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
  }, [ate, de, estacoes, estacoesSelecionadas, granularidade, router]);


  const parametros = useMemo(
    () => [...new Map(linhas.map((linha) => [linha.parametroId, {
      id: linha.parametroId,
      nome: linha.parametroNome,
      unidade: linha.unidade,
      precipitacao: linha.precipitacao,
    }])).values()],
    [linhas],
  );
  const totalPaginas = Math.ceil(linhas.length / ITENS_POR_PAGINA);
  const linhasVisiveis = linhas.slice(
    (paginaAtual - 1) * ITENS_POR_PAGINA,
    paginaAtual * ITENS_POR_PAGINA,
  );


  function alternarEstacao(id: string) {
    setEstacoesSelecionadas((selecionadas) =>
      selecionadas.includes(id)
        ? selecionadas.filter((selecionada) => selecionada !== id)
        : [...selecionadas, id],
    );
  }


  const temRelatorio = periodoGerado !== null;


  return (
    <div className="space-y-5">
      <PageHeading
        title="Relatório de histórico climático"
        description={`Análise de variáveis climáticas por período e estação${usuario?.licitacao ? ` · ${usuario.licitacao.codigoIdentificador}` : ''}.`}
        action={
          <div className="flex flex-wrap justify-end gap-2">
            {temRelatorio && linhas.length > 0 && (
              <>
                <Button type="button" variant="outline">
                  <Download /> CSV
                </Button>
                <Button type="button" variant="outline">
                  <Printer /> PDF
                </Button>
              </>
            )}
          </div>
        }
      />


      <section className="space-y-4 rounded-lg border border-border bg-card p-4" aria-label="Filtros do relatório">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <CampoData label="Data inicial" value={de} onChange={setDe} />
          <CampoData label="Data final" value={ate} onChange={setAte} />
          <div className="flex min-w-0 flex-col gap-1">
            <label htmlFor="granularidade" className="font-mono text-[10px] uppercase text-muted-foreground">
              Granularidade
            </label>
            <Select id="granularidade" value={granularidade} onChange={(event) => setGranularidade(event.target.value as Granularidade)}>
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
              <Button type="button" size="sm" variant="outline" onClick={() => setEstacoesSelecionadas(estacoes.map((estacao) => estacao.id))} disabled={estacoesCarregando || estacoes.length === 0}>
                Todas
              </Button>
              <Button type="button" size="sm" variant="outline" onClick={() => setEstacoesSelecionadas([])} disabled={estacoesCarregando || estacoes.length === 0}>
                Nenhuma
              </Button>
            </div>
          </div>


          {estacoesCarregando ? (
            <p className="py-3 text-sm text-muted-foreground" role="status">Carregando estações...</p>
          ) : erroEstacoes ? (
            <div className="flex flex-wrap items-center gap-3 text-sm text-destructive" role="alert">
              <p>{erroEstacoes}</p>
              <Button type="button" variant="outline" size="sm" onClick={() => {
                setEstacoesCarregando(true);
                setErroEstacoes(null);
                setTentativaEstacoes((valor) => valor + 1);
              }}>
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
          <Button type="button" onClick={() => void gerarRelatorio()} disabled={carregando || estacoesCarregando || Boolean(erroEstacoes) || estacoes.length === 0}>
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


      {temRelatorio && !carregando && linhas.length === 0 && !erroRelatorio && (
        <div className="rounded-lg border border-dashed border-border bg-card px-6 py-12 text-center">
          <h2 className="font-display text-sm font-semibold">Nenhum dado encontrado</h2>
          <p className="mt-1 text-sm text-muted-foreground">Não há leituras para as estações e o período selecionados.</p>
        </div>
      )}


      {temRelatorio && linhas.length > 0 && (
        <div className="space-y-5">
          <p className="text-sm text-muted-foreground">
            Período: {new Date(`${periodoGerado.de}T12:00:00`).toLocaleDateString('pt-BR')} a {new Date(`${periodoGerado.ate}T12:00:00`).toLocaleDateString('pt-BR')}
            {' · '}{granularidade === 'dia' ? 'Agrupado por dia' : 'Agrupado por hora'}
            {' · '}{estacoesSelecionadas.length} estação(ões)
          </p>


          <section className="space-y-3" aria-label="Gráficos do relatório">
            <h2 className="font-display text-base font-semibold">Evolução por parâmetro</h2>
            <div className="grid gap-4 xl:grid-cols-2">
              {parametros.map((parametro) => (
                <GraficoParametro key={parametro.id} parametro={parametro} linhas={linhas.filter((linha) => linha.parametroId === parametro.id)} granularidade={granularidade} />
              ))}
            </div>
          </section>


          <section className="space-y-3" aria-label="Tabela de totalizadores">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <div>
                <h2 className="font-display text-base font-semibold">Totalizadores</h2>
                <p className="text-sm text-muted-foreground">Precipitação usa o último valor acumulado retornado no intervalo; os demais parâmetros mostram média, mínimo e máximo.</p>
              </div>
              <span className="font-mono text-xs text-muted-foreground">{linhas.length.toLocaleString('pt-BR')} registros</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border bg-card">
              <table className="w-full min-w-[760px] text-left text-sm">
                <thead className="bg-muted/50 font-mono text-[10px] uppercase text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2">Período</th>
                    <th className="px-3 py-2">Estação</th>
                    <th className="px-3 py-2">Parâmetro</th>
                    <th className="px-3 py-2 text-right">Mínimo</th>
                    <th className="px-3 py-2 text-right">Máximo</th>
                    <th className="px-3 py-2 text-right">Média</th>
                    <th className="px-3 py-2 text-right">Acumulado</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                {linhasVisiveis.map((linha) => (
                    <tr key={linha.chave} className="hover:bg-muted/20">
                      <td className="whitespace-nowrap px-3 py-2">{rotuloPeriodo(linha.periodo, granularidade)}</td>
                      <td className="px-3 py-2">{linha.estacaoNome}</td>
                      <td className="px-3 py-2">{linha.parametroNome}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarValor(linha.minimo)} {linha.unidade}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarValor(linha.maximo)} {linha.unidade}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{formatarValor(linha.media)} {linha.unidade}</td>
                      <td className="px-3 py-2 text-right tabular-nums">{linha.precipitacao ? `${formatarValor(linha.total)} ${linha.unidade}` : '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <nav className="flex items-center justify-between gap-3" aria-label="Paginação da tabela">
              <p className="text-xs text-muted-foreground" aria-live="polite">
                Mostrando {((paginaAtual - 1) * ITENS_POR_PAGINA) + 1}–{Math.min(paginaAtual * ITENS_POR_PAGINA, linhas.length)} de {linhas.length} registros
              </p>
              <div className="flex items-center gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Página anterior"
                  onClick={() => setPaginaAtual((pagina) => Math.max(1, pagina - 1))}
                  disabled={paginaAtual === 1}
                >
                  <ChevronLeft /> Anterior
                </Button>
                <span className="min-w-16 text-center text-xs tabular-nums" aria-label={`Página ${paginaAtual} de ${totalPaginas}`}>
                  {paginaAtual} / {totalPaginas}
                </span>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  aria-label="Próxima página"
                  onClick={() => setPaginaAtual((pagina) => Math.min(totalPaginas, pagina + 1))}
                  disabled={paginaAtual === totalPaginas}
                >
                  Próxima <ChevronRight />
                </Button>
              </div>
            </nav>
          </section>
        </div>
      )}
    </div>
  );
}


function CampoData({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const id = label === 'Data inicial' ? 'data-inicial' : 'data-final';
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <label htmlFor={id} className="font-mono text-[10px] uppercase text-muted-foreground">{label}</label>
      <input id={id} type="date" value={value} onChange={(event) => onChange(event.target.value)} className="h-9 w-full rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring" />
    </div>
  );
}


function formatarValor(valor: number) {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2, minimumFractionDigits: 2 });
}


function GraficoParametro({
  parametro,
  linhas,
  granularidade,
}: {
  parametro: { id: string; nome: string; unidade: string; precipitacao: boolean };
  linhas: LinhaRelatorio[];
  granularidade: Granularidade;
}) {
  const periodos = [...new Set(linhas.map((linha) => linha.periodo))].sort();
  const estacoes = [...new Set(linhas.map((linha) => linha.estacaoId))];
  const series = estacoes.map((estacaoId, indice) => {
    const daEstacao = linhas.filter((linha) => linha.estacaoId === estacaoId);
    const valoresPorPeriodo = new Map(daEstacao.map((linha) => [linha.periodo, parametro.precipitacao ? linha.total : linha.media]));
    const pontos = daEstacao.map((linha) => {
      const indicePeriodo = periodos.indexOf(linha.periodo);
      const valor = valoresPorPeriodo.get(linha.periodo) ?? 0;
      return { x: 8 + (indicePeriodo / Math.max(periodos.length - 1, 1)) * 84, valor };
    });
    return {
      id: estacaoId,
      nome: daEstacao[0].estacaoNome,
      cor: CORES_GRAFICO[indice % CORES_GRAFICO.length],
      pontos,
    };
  });
  const valores = series.flatMap((serie) => serie.pontos.map((ponto) => ponto.valor));
  const minimo = Math.min(...valores);
  const maximo = Math.max(...valores);
  const amplitude = maximo - minimo || 1;
  const ticks = [0, Math.floor((periodos.length - 1) / 2), periodos.length - 1]
    .filter((indice, posicao, lista) => periodos[indice] !== undefined && lista.indexOf(indice) === posicao);


  return (
    <article className="min-w-0 overflow-hidden rounded-lg border border-border bg-card">
      <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
        <div>
          <h3 className="font-display text-sm font-semibold">{parametro.nome}</h3>
          <p className="text-xs text-muted-foreground">{parametro.precipitacao ? 'Acumulado por período' : 'Média por período'} · {parametro.unidade}</p>
        </div>
      </div>
      <div className="px-4 py-3">
        <svg viewBox="0 0 100 48" preserveAspectRatio="none" className="h-40 w-full" role="img" aria-label={`Gráfico de ${parametro.nome}`}>
          {[8, 24, 40].map((y) => <line key={y} x1="8" x2="92" y1={y} y2={y} stroke="currentColor" strokeOpacity=".12" vectorEffect="non-scaling-stroke" />)}
          {series.map((serie) => (
            <g key={serie.id}>
              <polyline
                points={serie.pontos.map((ponto) => `${ponto.x},${40 - ((ponto.valor - minimo) / amplitude) * 32}`).join(' ')}
                fill="none"
                stroke={serie.cor}
                strokeWidth="1.6"
                vectorEffect="non-scaling-stroke"
              />
              {serie.pontos.map((ponto, indice) => (
                <circle key={`${serie.id}-${indice}`} cx={ponto.x} cy={40 - ((ponto.valor - minimo) / amplitude) * 32} r=".8" fill={serie.cor} />
              ))}
            </g>
          ))}
          {ticks.map((indice) => (
            <text key={indice} x={8 + (indice / Math.max(periodos.length - 1, 1)) * 84} y="47" textAnchor="middle" fill="currentColor" fontSize="3">
              {rotuloPeriodo(periodos[indice], granularidade)}
            </text>
          ))}
        </svg>
        <div className="mt-3 flex flex-wrap gap-x-4 gap-y-2">
          {series.map((serie) => (
            <span key={serie.id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <span className="size-2 rounded-full" style={{ backgroundColor: serie.cor }} />
              {serie.nome}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}
