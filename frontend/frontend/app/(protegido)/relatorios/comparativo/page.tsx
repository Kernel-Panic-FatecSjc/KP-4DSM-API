'use client';

import { useEffect, useState } from 'react';
import { AlertTriangle, ChartNoAxesCombined, Download, FileText, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { API_URL, api, baixarDaApi, ErroApi, type EstacaoApi, type SensorApi } from '@/lib/api';

type Periodo = { inicio: string; fim: string };

type Estatistica = {
  estacaoId: string;
  estacaoNome: string;
  quantidade: number;
  media: number | null;
  mediana: number | null;
  desvioPadrao: number | null;
  variancia: number | null;
  quartil1: number | null;
  quartil2: number | null;
  quartil3: number | null;
  minimo: number | null;
  maximo: number | null;
};

type Resultado = {
  periodos: { inicio: string; fim: string; estacoes: Estatistica[] }[];
  metodoCalculo: string;
  microclimasRisco: { periodoIndice: number; estacaoId: string; estacaoNome: string; media: number; medianaGrupo: number; diferencaParaMediana: number }[];
};

const dataDeHoje = new Date();

function dataHa(dias: number) {
  const data = new Date(dataDeHoje);
  data.setDate(data.getDate() - dias);
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 10);
}

const periodosIniciais: Periodo[] = [
  { inicio: dataHa(14), fim: dataHa(8) },
  { inicio: dataHa(7), fim: dataHa(1) },
];

function formatarNumero(valor: number | null) {
  if (valor === null) return '—';
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor);
}

function formatarData(valor: string) {
  return new Intl.DateTimeFormat('pt-BR').format(new Date(valor));
}

function montarConsulta(estacoes: string[], parametroId: string, periodos: Periodo[]) {
  const query = new URLSearchParams();
  estacoes.forEach((id) => query.append('estacaoIds', id));
  query.set('parametroId', parametroId);
  periodos.forEach((periodo) => {
    const inicio = new Date(`${periodo.inicio}T00:00:00`).toISOString();
    const fim = new Date(`${periodo.fim}T23:59:59.999`).toISOString();
    query.append('periodos', `${inicio}|${fim}`);
  });
  return query;
}

function Boxplot({ resultado }: { resultado: Resultado }) {
  const todosValores = resultado.periodos.flatMap((periodo) =>
    periodo.estacoes.flatMap((estacao) => [estacao.minimo, estacao.maximo]),
  ).filter((valor): valor is number => valor !== null);

  if (todosValores.length === 0) {
    return <p className="p-6 text-center text-sm text-muted-foreground">Sem valores para mostrar.</p>;
  }

  const menorValor = Math.min(...todosValores);
  const maiorValor = Math.max(...todosValores);
  const diferenca = maiorValor - menorValor || 1;

  return (
    <div className="space-y-3 p-4">
      {resultado.periodos.map((periodo, periodoIndex) => (
        <div key={periodo.inicio} className="space-y-2">
          <p className="text-xs font-semibold text-muted-foreground">
            Período {periodoIndex + 1}: {formatarData(periodo.inicio)} – {formatarData(periodo.fim)}
          </p>
          {periodo.estacoes.map((estacao) => {
            const semValores = estacao.minimo === null || estacao.maximo === null;
            const discrepante = resultado.microclimasRisco.some((item) => item.periodoIndice === periodoIndex && item.estacaoId === estacao.estacaoId);
            const posicao = (valor: number) => `${((valor - menorValor) / diferenca) * 100}%`;
            const inicioCaixa = estacao.quartil1 ?? estacao.minimo;
            const fimCaixa = estacao.quartil3 ?? estacao.maximo;

            return (
              <div key={estacao.estacaoId} className="grid grid-cols-[150px_1fr] items-center gap-3 text-xs">
                <span className={discrepante ? 'truncate font-medium text-red-700' : 'truncate text-foreground'}>
                  {discrepante && '⚠ '}{estacao.estacaoNome}
                </span>
                {semValores ? <span className="text-muted-foreground">Sem dados</span> : (
                  <div className="relative h-8">
                    <div
                      className={`absolute top-1/2 h-0.5 -translate-y-1/2 ${discrepante ? 'bg-red-400' : 'bg-teal-600'}`}
                      style={{ left: posicao(estacao.minimo!), width: `${((estacao.maximo! - estacao.minimo!) / diferenca) * 100}%` }}
                    />
                    <div
                      className={`absolute top-1/2 h-5 -translate-y-1/2 rounded border ${discrepante ? 'border-red-500 bg-red-100' : 'border-teal-600 bg-teal-100'}`}
                      style={{ left: posicao(inicioCaixa!), width: `${Math.max(1, ((fimCaixa! - inicioCaixa!) / diferenca) * 100)}%` }}
                    />
                    {estacao.mediana !== null && <span className="absolute top-1/2 h-6 w-0.5 -translate-y-1/2 bg-slate-800" style={{ left: posicao(estacao.mediana) }} />}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
      <div className="flex justify-between border-t pt-2 text-[10px] text-muted-foreground">
        <span>{formatarNumero(menorValor)}</span>
        <span>{formatarNumero((menorValor + maiorValor) / 2)}</span>
        <span>{formatarNumero(maiorValor)}</span>
      </div>
      <p className="text-[11px] text-muted-foreground">Caixa = intervalo entre quartis; linha = mediana; haste = mínimo e máximo.</p>
    </div>
  );
}

export default function ComparativoPage() {
  const [estacoes, setEstacoes] = useState<EstacaoApi[]>([]);
  const [sensores, setSensores] = useState<SensorApi[]>([]);
  const [estacoesSelecionadas, setEstacoesSelecionadas] = useState<string[]>([]);
  const [parametroId, setParametroId] = useState('');
  const [periodos, setPeriodos] = useState<Periodo[]>(periodosIniciais);
  const [resultado, setResultado] = useState<Resultado | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [consultando, setConsultando] = useState(false);
  const [preparandoPdf, setPreparandoPdf] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    async function carregarOpcoes() {
      try {
        const listaEstacoes = await api<{ itens: EstacaoApi[] }>('/estacoes?tamanho=200');
        const listaSensores = await api<{ itens: SensorApi[] }>('/sensores?tamanho=200');
        setEstacoes(listaEstacoes.itens);
        setSensores(listaSensores.itens);
      } catch (erroApi) {
        setErro(erroApi instanceof ErroApi ? erroApi.message : 'Não foi possível carregar as opções.');
      } finally {
        setCarregando(false);
      }
    }

    void carregarOpcoes();
  }, []);

  function atualizarPeriodo(indice: number, campo: keyof Periodo, valor: string) {
    setPeriodos((atuais) => atuais.map((periodo, i) =>
      i === indice ? { ...periodo, [campo]: valor } : periodo,
    ));
  }

  async function consultar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErro(null);
    setResultado(null);

    if (estacoesSelecionadas.length === 0) {
      setErro('Selecione ao menos uma estação.');
      return;
    }
    if (!parametroId) {
      setErro('Selecione um parâmetro.');
      return;
    }
    if (periodos.length < 2 || periodos.some((p) => !p.inicio || !p.fim || p.inicio > p.fim)) {
      setErro('Informe pelo menos dois períodos válidos.');
      return;
    }

    const query = montarConsulta(estacoesSelecionadas, parametroId, periodos);

    setConsultando(true);
    try {
      setResultado(await api<Resultado>(`/relatorios/estatisticas?${query.toString()}`));
    } catch (erroApi) {
      setErro(erroApi instanceof ErroApi ? erroApi.message : 'Não foi possível gerar a comparação.');
    } finally {
      setConsultando(false);
    }
  }

  async function exportarPdf() {
    if (!resultado) return;
    setErro(null);
    setPreparandoPdf(true);
    try {
      const resposta = await fetch(`${API_URL}/relatorios/estatisticas/exportar-pdf`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ estacaoIds: estacoesSelecionadas, parametroId, periodos: montarConsulta(estacoesSelecionadas, parametroId, periodos).getAll('periodos') }),
      });
      if (!resposta.ok) {
        const corpo = await resposta.json().catch(() => null);
        throw new ErroApi(resposta.status, Array.isArray(corpo?.message) ? corpo.message.join(', ') : corpo?.message ?? 'Não foi possível gerar o PDF.');
      }
      const url = URL.createObjectURL(await resposta.blob());
      const link = document.createElement('a');
      link.href = url;
      link.download = 'relatorio-estatistico.pdf';
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (erroApi) {
      setErro(erroApi instanceof ErroApi ? erroApi.message : 'Não foi possível preparar o PDF.');
    } finally {
      setPreparandoPdf(false);
    }
  }

  function exportarCsv() {
    if (!resultado) return;
    const query = montarConsulta(estacoesSelecionadas, parametroId, periodos);
    baixarDaApi(`/relatorios/estatisticas/exportar.csv?${query.toString()}`);
  }

  const sensoresDisponiveis = sensores.filter((sensor) =>
    estacoes.some((estacao) =>
      (estacoesSelecionadas.length === 0 || estacoesSelecionadas.includes(estacao.id))
      && estacao.sensores.some((item) => item.id === sensor.id),
    ),
  );
  const semDados = resultado?.periodos.every((periodo) =>
    periodo.estacoes.every((estacao) => estacao.quantidade === 0),
  );
  const discrepantes = resultado?.microclimasRisco ?? [];
  const maiorMediana = resultado
    ? resultado.periodos.flatMap((periodo) => periodo.estacoes)
      .filter((estacao) => estacao.mediana !== null)
      .sort((a, b) => b.mediana! - a.mediana!)[0]
    : undefined;
  const estiloCampo = 'flex flex-col gap-1.5 text-xs text-muted-foreground';

  return (
    <div className="space-y-5 print:space-y-3">
      <div className="hidden border-b pb-3 print:block">
        <h1 className="text-xl font-bold">Relatório estatístico comparativo</h1>
        <p className="text-xs text-muted-foreground">Gerado em {new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date())}</p>
      </div>
      <div className="print:hidden"><PageHeading title="Análise comparativa" description="Compare as medições das estações em diferentes períodos." /></div>

      <form onSubmit={consultar} className="space-y-4 rounded-xl border border-border bg-card p-4 print:hidden">
        <div className="grid gap-4 lg:grid-cols-2">
          <fieldset className={estiloCampo}>
            <legend className="mb-2">Estações ({estacoesSelecionadas.length} selecionadas)</legend>
            <div className="max-h-44 space-y-1 overflow-y-auto rounded-md border border-border p-2">
              {carregando ? <p>Carregando estações…</p> : estacoes.map((estacao) => (
                <label key={estacao.id} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-foreground hover:bg-muted/50">
                  <input
                    type="checkbox"
                    checked={estacoesSelecionadas.includes(estacao.id)}
                    onChange={(evento) => setEstacoesSelecionadas((atuais) => evento.target.checked
                      ? [...atuais, estacao.id]
                      : atuais.filter((id) => id !== estacao.id))}
                  />
                  <span>{estacao.nome}</span>
                </label>
              ))}
              {!carregando && estacoes.length === 0 && <p>Nenhuma estação encontrada.</p>}
            </div>
          </fieldset>

          <label className={estiloCampo}>
            Parâmetro
            <select value={parametroId} onChange={(evento) => setParametroId(evento.target.value)} className="h-10 rounded-md border border-border bg-background px-3 text-sm text-foreground">
              <option value="">Selecione um parâmetro</option>
              {sensoresDisponiveis.map((sensor) => <option key={sensor.id} value={sensor.id}>{sensor.nome} ({sensor.unidade})</option>)}
            </select>
          </label>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs text-muted-foreground">Períodos (o primeiro será usado como referência)</p>
            <Button type="button" variant="outline" size="sm" onClick={() => setPeriodos([...periodos, { inicio: '', fim: '' }])}>
              <Plus /> Adicionar
            </Button>
          </div>
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-3">
            {periodos.map((periodo, indice) => (
              <div key={indice} className="flex items-end gap-2 rounded-md border border-border p-3">
                <span className="mb-2 text-xs text-muted-foreground">{indice + 1}º</span>
                <label className={`${estiloCampo} flex-1`}>De<input type="date" value={periodo.inicio} onChange={(e) => atualizarPeriodo(indice, 'inicio', e.target.value)} className="h-9 rounded border border-border bg-background px-2 text-foreground" /></label>
                <label className={`${estiloCampo} flex-1`}>Até<input type="date" value={periodo.fim} onChange={(e) => atualizarPeriodo(indice, 'fim', e.target.value)} className="h-9 rounded border border-border bg-background px-2 text-foreground" /></label>
                {periodos.length > 2 && <Button type="button" variant="ghost" size="icon" aria-label="Remover período" onClick={() => setPeriodos(periodos.filter((_, i) => i !== indice))}><Trash2 /></Button>}
              </div>
            ))}
          </div>
        </div>

        {erro && <p role="alert" className="flex gap-2 rounded-md border border-red-200 bg-red-50 p-3 text-sm text-red-800"><AlertTriangle className="size-4" />{erro}</p>}
        <div className="flex justify-end">
          <Button type="submit" disabled={consultando || carregando}><ChartNoAxesCombined />{consultando ? 'Analisando…' : 'Gerar comparação'}</Button>
        </div>
      </form>

      {consultando && <div role="status" className="flex min-h-40 items-center justify-center gap-2 rounded-xl border border-border bg-card text-sm text-muted-foreground"><RefreshCw className="animate-spin" />Carregando análise…</div>}
      {!consultando && !resultado && !erro && <p className="rounded-xl border border-dashed border-border p-8 text-center text-sm text-muted-foreground">Escolha as estações, o parâmetro e os períodos para ver o resultado.</p>}

      {resultado && !consultando && <>
        <div className="flex flex-wrap justify-end gap-2 print:hidden">
          <Button type="button" variant="outline" onClick={exportarCsv}><Download />Exportar CSV</Button>
          <Button type="button" onClick={() => void exportarPdf()} disabled={preparandoPdf}>
            <FileText />{preparandoPdf ? 'Preparando PDF…' : 'Exportar PDF'}
          </Button>
        </div>

        {semDados && <p role="status" className="rounded-md border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">Não há medições para os filtros selecionados.</p>}

        <section className="rounded-xl border border-border bg-card p-4 print:break-inside-avoid">
          <h2 className="text-sm font-semibold">Sumário executivo</h2>
          <p className="mt-2 text-sm text-muted-foreground">
            {semDados
              ? 'Não foram encontradas medições para os filtros selecionados.'
              : `Maior mediana observada: ${maiorMediana?.estacaoNome ?? '—'} (${formatarNumero(maiorMediana?.mediana ?? null)}). ${discrepantes.length} resultado(s) sinalizado(s) como discrepante(s).`}
          </p>
          {discrepantes.length > 0 && <p className="mt-1 text-sm text-red-700">Pontos para revisão: {discrepantes.map((item) => item.estacaoNome).join(', ')}.</p>}
          <p className="mt-2 text-[11px] text-muted-foreground">Critério: mediana além de dois desvios padrão populacionais da média das medianas do período.</p>
        </section>

        <section className="rounded-xl border border-border bg-card print:break-inside-avoid">
          <header className="flex items-center gap-2 border-b border-border px-4 py-3">
            <ChartNoAxesCombined className="size-4 text-teal-600" />
            <h2 className="text-sm font-semibold">Distribuição dos valores</h2>
          </header>
          <Boxplot resultado={resultado} />
        </section>

        <section className="overflow-hidden rounded-xl border border-border bg-card">
          <header className="border-b border-border px-4 py-3">
            <h2 className="text-sm font-semibold">Síntese estatística</h2>
            <p className="text-xs text-muted-foreground">{resultado.metodoCalculo}</p>
          </header>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[700px] text-left text-xs">
              <thead className="bg-muted/40 text-muted-foreground">
                <tr>
                  <th className="px-3 py-2">Métrica</th>
                  {resultado.periodos.map((periodo, indice) => <th key={periodo.inicio} colSpan={periodo.estacoes.length} className="px-3 py-2">Período {indice + 1}: {formatarData(periodo.inicio)} – {formatarData(periodo.fim)}</th>)}
                </tr>
                <tr><th className="px-3 py-2">Estação</th>{resultado.periodos.flatMap((periodo) => periodo.estacoes.map((estacao) => <th key={`${periodo.inicio}-${estacao.estacaoId}`} className="px-3 py-2">{estacao.estacaoNome}</th>))}</tr>
              </thead>
              <tbody>
                {([
                  ['Leituras', 'quantidade'], ['Média', 'media'], ['Mediana', 'mediana'],
                  ['Desvio padrão', 'desvioPadrao'], ['Variância', 'variancia'],
                  ['1º quartil', 'quartil1'], ['3º quartil', 'quartil3'], ['Mínimo', 'minimo'], ['Máximo', 'maximo'],
                ] as const).map(([nome, campo]) => (
                  <tr key={campo} className="border-t border-border">
                    <th className="px-3 py-2 font-medium">{nome}</th>
                    {resultado.periodos.flatMap((periodo) => periodo.estacoes.map((estacao) => (
                      <td key={`${periodo.inicio}-${estacao.estacaoId}`} className="px-3 py-2 font-mono">{formatarNumero(estacao[campo])}</td>
                    )))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="border-t border-border px-4 py-2 text-[11px] text-muted-foreground print:hidden">
            Destaque em vermelho: microclima em risco segundo o critério aplicado pela API.
          </p>
        </section>
      </>}
    </div>
  );
}
