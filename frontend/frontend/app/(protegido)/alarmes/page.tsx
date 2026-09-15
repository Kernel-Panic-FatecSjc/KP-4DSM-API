'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  api,
  ErroApi,
  type FiltrosAlarmes,
  type ListaAlarmes,
  type OpcoesFiltroAlarmes,
  type SeveridadeAlerta,
  type StatusAlarme,
} from '@/lib/api';

const LABEL_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'Atenção',
  ALERTA: 'Alerta',
  EMERGENCIA: 'Emergência',
};

const COR_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'bg-yellow-100 text-yellow-800',
  ALERTA: 'bg-orange-100 text-orange-800',
  EMERGENCIA: 'bg-red-100 text-red-800',
};

const LABEL_STATUS: Record<StatusAlarme, string> = {
  ABERTO: 'Aberto',
  RECONHECIDO: 'Reconhecido',
  RESOLVIDO: 'Resolvido',
};

const COR_STATUS: Record<StatusAlarme, string> = {
  ABERTO: 'bg-red-100 text-red-800',
  RECONHECIDO: 'bg-blue-100 text-blue-800',
  RESOLVIDO: 'bg-green-100 text-green-800',
};

function montarQuery(filtros: FiltrosAlarmes): string {
  const parametros = new URLSearchParams();
  if (filtros.estacaoId) parametros.set('estacaoId', filtros.estacaoId);
  if (filtros.tipoParametroId) parametros.set('tipoParametroId', filtros.tipoParametroId);
  if (filtros.severidade) parametros.set('severidade', filtros.severidade);
  if (filtros.status) parametros.set('status', filtros.status);
  if (filtros.de) parametros.set('de', new Date(filtros.de).toISOString());
  if (filtros.ate) parametros.set('ate', new Date(filtros.ate).toISOString());
  parametros.set('pagina', String(filtros.pagina ?? 1));
  return parametros.toString();
}

export default function AlarmesPage() {
  const router = useRouter();
  const [opcoes, setOpcoes] = useState<OpcoesFiltroAlarmes | null>(null);
  const [resultado, setResultado] = useState<ListaAlarmes | null>(null);
  const [filtros, setFiltros] = useState<FiltrosAlarmes>({ pagina: 1 });
  const [erro, setErro] = useState<string | null>(null);
  const [carregando, setCarregando] = useState(false);

  const carregarHistorico = useCallback(
    async (filtrosAtuais: FiltrosAlarmes) => {
      setCarregando(true);
      setErro(null);
      try {
        const dados = await api<ListaAlarmes>(`/alarmes?${montarQuery(filtrosAtuais)}`);
        setResultado(dados);
      } catch (erroCapturado) {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.push('/login');
          return;
        }
        setErro('Erro ao carregar histórico de alarmes');
      } finally {
        setCarregando(false);
      }
    },
    [router],
  );

  useEffect(() => {
    api<OpcoesFiltroAlarmes>('/alarmes/filtros')
      .then(setOpcoes)
      .catch((erroCapturado) => {
        if (erroCapturado instanceof ErroApi && erroCapturado.status === 401) {
          router.push('/login');
        }
      });
  }, [router]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- recarrega o histórico sempre que os filtros mudam
    carregarHistorico(filtros);
  }, [filtros, carregarHistorico]);

  function atualizarFiltro<K extends keyof FiltrosAlarmes>(campo: K, valor: FiltrosAlarmes[K]) {
    setFiltros((atual) => ({ ...atual, [campo]: valor || undefined, pagina: 1 }));
  }

  function irParaPagina(pagina: number) {
    setFiltros((atual) => ({ ...atual, pagina }));
  }

  const totalPaginas = resultado ? Math.max(1, Math.ceil(resultado.total / resultado.tamanho)) : 1;

  return (
    <main className="flex flex-1 flex-col gap-6 p-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold">Histórico de Alertas Disparados</h1>
          <p className="text-sm text-zinc-600">Consulta global de ocorrências, com filtros por estação, parâmetro, severidade, status e período.</p>
        </div>
        <Link href="/usuarios" className="rounded border px-3 py-1.5 text-sm">
          Usuários
        </Link>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded border p-4">
        <div className="flex flex-col gap-1">
          <label htmlFor="filtroEstacao" className="text-sm">
            Estação
          </label>
          <select
            id="filtroEstacao"
            value={filtros.estacaoId ?? ''}
            onChange={(e) => atualizarFiltro('estacaoId', e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">Todas</option>
            {opcoes?.estacoes.map((estacao) => (
              <option key={estacao.id} value={estacao.id}>
                {estacao.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtroParametro" className="text-sm">
            Parâmetro
          </label>
          <select
            id="filtroParametro"
            value={filtros.tipoParametroId ?? ''}
            onChange={(e) => atualizarFiltro('tipoParametroId', e.target.value)}
            className="rounded border px-3 py-2"
          >
            <option value="">Todos</option>
            {opcoes?.tiposParametro.map((tipo) => (
              <option key={tipo.id} value={tipo.id}>
                {tipo.nome}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtroSeveridade" className="text-sm">
            Severidade
          </label>
          <select
            id="filtroSeveridade"
            value={filtros.severidade ?? ''}
            onChange={(e) => atualizarFiltro('severidade', e.target.value as SeveridadeAlerta)}
            className="rounded border px-3 py-2"
          >
            <option value="">Todas</option>
            {opcoes?.severidades.map((severidade) => (
              <option key={severidade} value={severidade}>
                {LABEL_SEVERIDADE[severidade]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtroStatus" className="text-sm">
            Status
          </label>
          <select
            id="filtroStatus"
            value={filtros.status ?? ''}
            onChange={(e) => atualizarFiltro('status', e.target.value as StatusAlarme)}
            className="rounded border px-3 py-2"
          >
            <option value="">Todos</option>
            {opcoes?.status.map((status) => (
              <option key={status} value={status}>
                {LABEL_STATUS[status]}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtroDe" className="text-sm">
            De
          </label>
          <input
            id="filtroDe"
            type="datetime-local"
            value={filtros.de ?? ''}
            onChange={(e) => atualizarFiltro('de', e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="filtroAte" className="text-sm">
            Até
          </label>
          <input
            id="filtroAte"
            type="datetime-local"
            value={filtros.ate ?? ''}
            onChange={(e) => atualizarFiltro('ate', e.target.value)}
            className="rounded border px-3 py-2"
          />
        </div>

        <button
          type="button"
          onClick={() => setFiltros({ pagina: 1 })}
          className="rounded border px-3 py-2 text-sm"
        >
          Limpar filtros
        </button>
      </div>

      {erro && <p className="text-sm text-red-600">{erro}</p>}

      {carregando && !resultado ? (
        <p>Carregando...</p>
      ) : (
        <>
          <table className="w-full max-w-5xl border-collapse text-left text-sm">
            <thead>
              <tr className="border-b">
                <th className="py-2 pr-4">Data/Hora</th>
                <th className="py-2 pr-4">Estação</th>
                <th className="py-2 pr-4">Parâmetro</th>
                <th className="py-2 pr-4">Severidade</th>
                <th className="py-2 pr-4">Status</th>
              </tr>
            </thead>
            <tbody>
              {resultado?.itens.map((alarme) => (
                <tr key={alarme.id} className="border-b">
                  <td className="py-2 pr-4">
                    {new Date(alarme.disparadoEm).toLocaleString('pt-BR')}
                  </td>
                  <td className="py-2 pr-4">{alarme.estacao.nome}</td>
                  <td className="py-2 pr-4">
                    {alarme.parametro.nome} ({alarme.valorMedido}
                    {alarme.parametro.unidade})
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${COR_SEVERIDADE[alarme.severidade]}`}>
                      {LABEL_SEVERIDADE[alarme.severidade]}
                    </span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className={`rounded px-2 py-0.5 text-xs font-medium ${COR_STATUS[alarme.status]}`}>
                      {LABEL_STATUS[alarme.status]}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {resultado && resultado.itens.length === 0 && (
            <p className="text-sm text-zinc-500">Nenhuma ocorrência encontrada para os filtros selecionados.</p>
          )}

          {resultado && resultado.total > 0 && (
            <div className="flex items-center gap-3 text-sm">
              <button
                type="button"
                disabled={resultado.pagina <= 1}
                onClick={() => irParaPagina(resultado.pagina - 1)}
                className="rounded border px-3 py-1.5 disabled:opacity-40"
              >
                Anterior
              </button>
              <span>
                Página {resultado.pagina} de {totalPaginas} · {resultado.total} ocorrência(s)
              </span>
              <button
                type="button"
                disabled={resultado.pagina >= totalPaginas}
                onClick={() => irParaPagina(resultado.pagina + 1)}
                className="rounded border px-3 py-1.5 disabled:opacity-40"
              >
                Próxima
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}
