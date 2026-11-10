'use client';

import { useCallback, useEffect, useState } from 'react';
import { AlertTriangle, FileDown, FileSearch, FileText, Filter, RefreshCw, ShieldCheck, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  api,
  baixarDaApi,
  ErroApi,
  type AcaoAlarme,
  type OcorrenciaIncidente,
  type RelatorioIncidentes,
  type SeveridadeAlerta,
  type StatusAlarme,
} from '@/lib/api';
import {
  filtrosIniciaisIncidentes,
  formatarDuracao,
  parametrosIncidentes,
  SIMBOLO_OPERADOR,
  type FiltrosIncidentes,
} from '@/lib/incidentes';
import { ehTecsus } from '@/lib/perfil';
import { cn } from '@/lib/utils';

const SEVERIDADES: Record<SeveridadeAlerta, { rotulo: string; cor: string }> = {
  ATENCAO: { rotulo: 'Atenção', cor: 'bg-aqua' },
  ALERTA: { rotulo: 'Alerta', cor: 'bg-warning' },
  EMERGENCIA: { rotulo: 'Emergência', cor: 'bg-critical' },
};

const STATUS: Record<StatusAlarme, string> = {
  ABERTO: 'Aberta',
  RECONHECIDO: 'Reconhecida',
  RESOLVIDO: 'Resolvida',
};

function formatarDataHora(valor: string): string {
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'short', timeStyle: 'short' }).format(new Date(valor));
}

function formatarNumero(valor: number): string {
  return new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 2 }).format(valor);
}

function Acao({ rotulo, acao }: { rotulo: string; acao: AcaoAlarme | null }) {
  if (!acao) return null;
  return (
    <p>
      {rotulo} {acao.por ? `por ${acao.por.nome} ` : ''}em {formatarDataHora(acao.em)}
    </p>
  );
}

function Severidade({ severidade }: { severidade: SeveridadeAlerta }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap font-mono text-[10px] font-semibold">
      <span className={cn('size-1.5 rounded-full', SEVERIDADES[severidade].cor)} />
      {SEVERIDADES[severidade].rotulo.toLowerCase()}
    </span>
  );
}

function Campo({ rotulo, children }: { rotulo: string; children: React.ReactNode }) {
  return (
    <label className="flex min-w-0 flex-col gap-1 font-mono text-[10px] uppercase text-muted-foreground">
      {rotulo}
      {children}
    </label>
  );
}

export default function RelatorioIncidentesPage() {
  const router = useRouter();
  const tecsus = ehTecsus(useUsuario());
  const [iniciais] = useState(() => filtrosIniciaisIncidentes());
  const [filtros, setFiltros] = useState<FiltrosIncidentes>(iniciais);
  const [relatorio, setRelatorio] = useState<RelatorioIncidentes | null>(null);
  // Os arquivos saem com os filtros da última consulta, os mesmos da tela.
  const [aplicados, setAplicados] = useState<FiltrosIncidentes>(iniciais);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(
    async (consulta: FiltrosIncidentes) => {
      setCarregando(true);
      setErro(null);
      setAplicados(consulta);
      try {
        setRelatorio(await api<RelatorioIncidentes>(`/relatorios/incidentes?${parametrosIncidentes(consulta)}`));
      } catch (erroCapturado) {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.replace('/login?proximo=/relatorios/incidentes');
          return;
        }
        setErro(erroCapturado instanceof ErroApi ? erroCapturado.message : 'Não foi possível carregar o relatório de incidentes.');
        setRelatorio(null);
      } finally {
        setCarregando(false);
      }
    },
    [router],
  );

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- consulta inicial com o período padrão
    void carregar(iniciais);
  }, [carregar, iniciais]);

  const alterar = <K extends keyof FiltrosIncidentes>(campo: K, valor: FiltrosIncidentes[K]) =>
    setFiltros((atual) => ({ ...atual, [campo]: valor }));

  function consultar(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    if (!filtros.de || !filtros.ate) {
      setErro('Informe o período (data inicial e final).');
      return;
    }
    if (Boolean(filtros.latitude.trim()) !== Boolean(filtros.longitude.trim())) {
      setErro('Para filtrar por raio, informe latitude e longitude.');
      return;
    }
    void carregar(filtros);
  }

  function limpar() {
    setFiltros(iniciais);
    void carregar(iniciais);
  }

  const ocorrencias = relatorio?.ocorrencias ?? [];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Relatório de incidentes"
        description="Ocorrências de alertas por severidade, período e região, com o parâmetro que superou o limiar, a duração da anomalia e as ações tomadas."
        action={
          <div className="flex flex-wrap gap-2">
            <Button
              type="button"
              variant="outline"
              disabled={!relatorio || carregando}
              onClick={() => baixarDaApi(`/relatorios/incidentes/csv?${parametrosIncidentes(aplicados)}`)}
            >
              <FileDown />
              CSV
            </Button>
            <Button
              type="button"
              disabled={!relatorio || carregando}
              onClick={() => baixarDaApi(`/relatorios/incidentes/pdf?${parametrosIncidentes(aplicados)}`)}
            >
              <FileText />
              Emitir laudo (PDF)
            </Button>
          </div>
        }
      />

      <form onSubmit={consultar} className="rounded-lg border border-border bg-card p-4" aria-label="Filtros do relatório">
        <div className="mb-4 flex items-center gap-2">
          <Filter className="size-4 text-aqua" />
          <h2 className="font-display text-sm font-semibold">Filtros</h2>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <Campo rotulo="Data inicial">
            <Input type="date" required value={filtros.de} onChange={(e) => alterar('de', e.target.value)} />
          </Campo>
          <Campo rotulo="Data final">
            <Input type="date" required value={filtros.ate} onChange={(e) => alterar('ate', e.target.value)} />
          </Campo>
          <Campo rotulo="Severidade">
            <Select value={filtros.severidade} onChange={(e) => alterar('severidade', e.target.value as SeveridadeAlerta | '')}>
              <option value="">Todas</option>
              {(Object.keys(SEVERIDADES) as SeveridadeAlerta[]).map((severidade) => (
                <option key={severidade} value={severidade}>
                  {SEVERIDADES[severidade].rotulo}
                </option>
              ))}
            </Select>
          </Campo>
          <Campo rotulo="Endereço (bairro, cidade)">
            <Input maxLength={200} placeholder="Ex.: Centro" value={filtros.endereco} onChange={(e) => alterar('endereco', e.target.value)} />
          </Campo>
          <Campo rotulo="Latitude">
            <Input inputMode="decimal" placeholder="-23.18" value={filtros.latitude} onChange={(e) => alterar('latitude', e.target.value)} />
          </Campo>
          <Campo rotulo="Longitude">
            <Input inputMode="decimal" placeholder="-45.88" value={filtros.longitude} onChange={(e) => alterar('longitude', e.target.value)} />
          </Campo>
          <Campo rotulo="Raio (km)">
            <Input type="number" min={0.1} max={1000} step="any" placeholder="100" value={filtros.raioKm} onChange={(e) => alterar('raioKm', e.target.value)} />
          </Campo>
          <Campo rotulo="Tolerância entre leituras (min)">
            <Input
              type="number"
              min={1}
              max={1440}
              placeholder="15"
              value={filtros.toleranciaMinutos}
              onChange={(e) => alterar('toleranciaMinutos', e.target.value)}
            />
          </Campo>
          {tecsus && (
            <Campo rotulo="Licitação">
              <SeletorLicitacao valor={filtros.licitacaoId} onChange={(licitacaoId) => alterar('licitacaoId', licitacaoId)} rotuloTodas="Todas as licitações" />
            </Campo>
          )}
          <div className="flex items-end gap-2">
            <Button type="submit" className="flex-1" disabled={carregando}>
              <FileSearch />
              {carregando ? 'Consultando...' : 'Gerar relatório'}
            </Button>
            <Button type="button" variant="outline" size="icon" className="size-9" onClick={limpar} disabled={carregando} aria-label="Limpar filtros">
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

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo por severidade">
        {(relatorio?.resumoPorSeveridade ?? []).map((resumo) => (
          <article key={resumo.severidade} className="rounded-lg border border-border bg-card px-4 py-4">
            <div className="flex items-center justify-between">
              <Severidade severidade={resumo.severidade} />
              <AlertTriangle className="size-4 text-muted-foreground" />
            </div>
            <p className="mt-2 font-display text-2xl font-semibold">{resumo.ocorrencias}</p>
            <p className="font-mono text-[10px] text-muted-foreground">
              ocorrência(s) · duração total {resumo.ocorrencias ? formatarDuracao(resumo.duracaoTotalSegundos) : '—'}
            </p>
          </article>
        ))}
      </section>

      <section className="overflow-hidden rounded-lg border border-border bg-card" aria-label="Ocorrências">
        <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
          <div>
            <h2 className="font-display text-sm font-semibold">Ocorrências</h2>
            <p className="font-mono text-[10px] text-muted-foreground">
              {relatorio
                ? `${ocorrencias.length} ocorrência(s) · tolerância de ${relatorio.toleranciaMinutos} min entre leituras`
                : carregando
                  ? 'Carregando...'
                  : '—'}
            </p>
          </div>
          {carregando && <RefreshCw className="size-4 animate-spin text-muted-foreground" />}
        </div>

        {carregando && !relatorio ? (
          <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">Carregando ocorrências...</div>
        ) : !relatorio ? (
          <div className="grid min-h-56 place-items-center px-6 text-center text-sm text-muted-foreground">
            Não foi possível montar o relatório. Revise os filtros e tente de novo.
          </div>
        ) : ocorrencias.length === 0 ? (
          <div className="grid min-h-56 place-items-center px-6 text-center">
            <div>
              <ShieldCheck className="mx-auto mb-3 size-8 text-aqua" />
              <p className="font-display text-sm font-semibold">Nenhuma ocorrência no período</p>
              <p className="mt-1 text-xs text-muted-foreground">Nenhum alerta foi disparado com os filtros informados.</p>
            </div>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[980px] text-left text-sm">
              <thead className="border-b border-border bg-muted/30 font-mono text-[10px] uppercase text-muted-foreground">
                <tr>
                  <th className="px-4 py-3 font-medium">Início / fim</th>
                  <th className="px-4 py-3 font-medium">Estação</th>
                  <th className="px-4 py-3 font-medium">Parâmetro</th>
                  <th className="px-4 py-3 font-medium">Limiar</th>
                  <th className="px-4 py-3 font-medium">Pico</th>
                  <th className="px-4 py-3 font-medium">Duração</th>
                  <th className="px-4 py-3 font-medium">Severidade</th>
                  <th className="px-4 py-3 font-medium">Ações</th>
                </tr>
              </thead>
              <tbody>
                {ocorrencias.map((ocorrencia) => (
                  <LinhaOcorrencia key={`${ocorrencia.alertaId}-${ocorrencia.inicio}`} ocorrencia={ocorrencia} />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function LinhaOcorrencia({ ocorrencia }: { ocorrencia: OcorrenciaIncidente }) {
  const unidade = ocorrencia.parametro.unidade;
  return (
    <tr className="border-b border-border align-top last:border-0 hover:bg-muted/30">
      <td className="whitespace-nowrap px-4 py-3 font-mono text-[11px] text-muted-foreground">
        <p>{formatarDataHora(ocorrencia.inicio)}</p>
        <p>{formatarDataHora(ocorrencia.fim)}</p>
      </td>
      <td className="px-4 py-3 font-medium">{ocorrencia.estacao.nome}</td>
      <td className="px-4 py-3">{ocorrencia.parametro.nome}</td>
      <td className="whitespace-nowrap px-4 py-3 font-mono text-[12px]">
        {SIMBOLO_OPERADOR[ocorrencia.operador] ?? ocorrencia.operador} {formatarNumero(ocorrencia.valorLimite)} {unidade}
      </td>
      <td className="whitespace-nowrap px-4 py-3 font-display font-semibold tabular-nums">
        {formatarNumero(ocorrencia.valorPico)} {unidade}
      </td>
      <td className="whitespace-nowrap px-4 py-3">
        {formatarDuracao(ocorrencia.duracaoSegundos)}
        <p className="font-mono text-[10px] text-muted-foreground">{ocorrencia.leituras} leitura(s)</p>
      </td>
      <td className="px-4 py-3">
        <Severidade severidade={ocorrencia.severidade} />
      </td>
      <td className="px-4 py-3 font-mono text-[10px] leading-snug text-muted-foreground">
        <p className="font-semibold text-foreground">{STATUS[ocorrencia.status]}</p>
        <Acao rotulo="Reconhecida" acao={ocorrencia.reconhecimento} />
        <Acao rotulo="Resolvida" acao={ocorrencia.resolucao} />
        {ocorrencia.observacoes.map((observacao) => (
          <p key={observacao} className="italic">
            “{observacao}”
          </p>
        ))}
      </td>
    </tr>
  );
}
