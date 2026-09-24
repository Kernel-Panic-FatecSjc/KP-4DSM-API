'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { DataTable, type Column } from '@/components/DataTable';
import { api, ErroApi, type Alerta, type ListaAlertas, type OpcoesFiltroAlertas, type SeveridadeAlerta } from '@/lib/api';
import { useRouter } from 'next/navigation';
import { Input } from '@/components/ui/input';
import { Pencil, Plus, X } from 'lucide-react';

const ITEMS_PER_PAGE = 5;

type FiltroSeveridade = 'TODOS' | SeveridadeAlerta;
type OperadorAlerta = 'MAIOR_QUE' | 'MENOR_QUE' | 'IGUAL_A' | 'DIFERENTE_DE' | 'MAIOR_OU_IGUAL' | 'MENOR_OU_IGUAL';

type FormularioAlerta = {
  parametroId: string;
  operador: OperadorAlerta;
  valorLimite: string;
  severidade: SeveridadeAlerta;
  ativo: boolean;
};

const FORMULARIO_INICIAL: FormularioAlerta = {
  parametroId: '',
  operador: 'MAIOR_QUE',
  valorLimite: '',
  severidade: 'ATENCAO',
  ativo: true,
};

const OPERADORES: { valor: OperadorAlerta; label: string }[] = [
  { valor: 'MAIOR_QUE', label: 'Maior que' },
  { valor: 'MENOR_QUE', label: 'Menor que' },
  { valor: 'IGUAL_A', label: 'Igual a' },
  { valor: 'DIFERENTE_DE', label: 'Diferente de' },
  { valor: 'MAIOR_OU_IGUAL', label: 'Maior ou igual a' },
  { valor: 'MENOR_OU_IGUAL', label: 'Menor ou igual a' },
];

function formatarSeveridade(severidade: SeveridadeAlerta) {
  switch (severidade) {
    case 'EMERGENCIA':
      return 'Emergência';

    case 'ALERTA':
      return 'Alerta';

    case 'ATENCAO':
      return 'Atenção';

    default:
      return severidade;
  }
}

function classeSeveridade(severidade: SeveridadeAlerta) {
  switch (severidade) {
    case 'EMERGENCIA':
      return 'bg-critical/10 border-critical/30 text-critical';

    case 'ALERTA':
      return 'bg-warning/10 border-warning/30 text-warning';

    case 'ATENCAO':
      return 'bg-lime/10 border-lime/30 text-lime';

    default:
      return 'bg-muted border-border text-muted-foreground';
  }
}

function formatarData(data: string) {
  const dataFormatada = new Date(data);

  if (Number.isNaN(dataFormatada.getTime())) {
    return data;
  }

  return dataFormatada.toLocaleString('pt-BR', {
    dateStyle: 'short',
    timeStyle: 'short',
  });
}

export default function AlertasPage() {
  const router = useRouter();

  const [alertas, setAlertas] = useState<Alerta[]>([]);
  const [opcoesFiltro, setOpcoesFiltro] =
    useState<OpcoesFiltroAlertas | null>(null);

  const [totalAlertas, setTotalAlertas] = useState(0);
  const [tamanhoPagina, setTamanhoPagina] =
    useState(ITEMS_PER_PAGE);

  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');

  const [severidadeFilter, setSeveridadeFilter] =
    useState<FiltroSeveridade>('TODOS');

  const [estacaoFilter, setEstacaoFilter] =
    useState('');

  const [tipoParametroFilter, setTipoParametroFilter] =
    useState('');

  const [ativoFilter, setAtivoFilter] =
    useState<'TODOS' | 'true' | 'false'>('TODOS');

  const [currentPage, setCurrentPage] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [alertaEditando, setAlertaEditando] = useState<Alerta | null>(null);
  const [formulario, setFormulario] = useState<FormularioAlerta>(FORMULARIO_INICIAL);
  const [salvando, setSalvando] = useState(false);

  const carregarOpcoesFiltro = useCallback(async () => {
    try {
      const resposta =
        await api<OpcoesFiltroAlertas>(
          '/alertas/filtros',
        );

      setOpcoesFiltro(resposta);
    } catch (erroApi) {
      if (erroApi instanceof ErroApi) {
        if (erroApi.status === 401) {
          router.push('/login?proximo=/alertas');
          return;
        }

        setErro(erroApi.message);
        return;
      }

      console.error(erroApi);
      setErro(
        'Não foi possível carregar os filtros.',
      );
    }
  }, [router]);

  const carregarAlertas = useCallback(async () => {
    try {
      setCarregando(true);
      setErro(null);

      const parametros = new URLSearchParams();

      parametros.set(
        'pagina',
        String(currentPage),
      );

      parametros.set(
        'tamanho',
        String(ITEMS_PER_PAGE),
      );

      if (
        severidadeFilter !== 'TODOS'
      ) {
        parametros.set(
          'severidade',
          severidadeFilter,
        );
      }

      if (estacaoFilter) {
        parametros.set(
          'estacaoId',
          estacaoFilter,
        );
      }

      if (tipoParametroFilter) {
        parametros.set(
          'tipoParametroId',
          tipoParametroFilter,
        );
      }

      if (ativoFilter !== 'TODOS') {
        parametros.set(
          'ativo',
          ativoFilter,
        );
      }

      const resposta =
        await api<ListaAlertas>(
          `/alertas?${parametros.toString()}`,
        );

      setAlertas(resposta.itens);
      setTotalAlertas(resposta.total);
      setTamanhoPagina(resposta.tamanho);
    } catch (erroApi) {
      if (erroApi instanceof ErroApi) {
        if (erroApi.status === 401) {
          router.push('/login?proximo=/alertas');
          return;
        }

        setErro(erroApi.message);
        return;
      }

      console.error(erroApi);

      setErro(
        'Não foi possível carregar os alertas.',
      );
    } finally {
      setCarregando(false);
    }
  }, [
    currentPage,
    severidadeFilter,
    estacaoFilter,
    tipoParametroFilter,
    ativoFilter,
    router,
  ]);

  useEffect(() => {
    const agendamento = window.setTimeout(() => {
      void carregarOpcoesFiltro();
    }, 0);

    return () => window.clearTimeout(agendamento);
  }, [carregarOpcoesFiltro]);

  useEffect(() => {
    const agendamento = window.setTimeout(() => {
      void carregarAlertas();
    }, 0);

    return () => window.clearTimeout(agendamento);
  }, [carregarAlertas]);

  const alertasFiltrados = useMemo(() => {
    const query = searchTerm
      .trim()
      .toLowerCase();

    if (!query) {
      return alertas;
    }

    return alertas.filter((alerta) => {
      return (
        alerta.id
          .toLowerCase()
          .includes(query) ||
        alerta.operador
          .toLowerCase()
          .includes(query) ||
        alerta.estacao.nome
          .toLowerCase()
          .includes(query) ||
        alerta.parametro.nome
          .toLowerCase()
          .includes(query)
      );
    });
  }, [alertas, searchTerm]);

  const totalPages = Math.max(
    1,
    Math.ceil(
      totalAlertas / tamanhoPagina,
    ),
  );

  const safeCurrentPage = Math.min(
    currentPage,
    totalPages,
  );

  const quantidadeEmergencias =
    alertas.filter(
      (alerta) =>
        alerta.severidade === 'EMERGENCIA',
    ).length;

  const quantidadeAtivos =
    alertas.filter(
      (alerta) => alerta.ativo,
    ).length;

  const limparFiltros = () => {
    setSearchTerm('');
    setSeveridadeFilter('TODOS');
    setEstacaoFilter('');
    setTipoParametroFilter('');
    setAtivoFilter('TODOS');
    setCurrentPage(1);
  };

  const abrirCadastro = () => {
    setAlertaEditando(null);
    setFormulario(FORMULARIO_INICIAL);
    setModalAberto(true);
  };

  const abrirEdicao = (alerta: Alerta) => {
    setAlertaEditando(alerta);
    setFormulario({
      parametroId: alerta.parametro.id,
      operador: alerta.operador as OperadorAlerta,
      valorLimite: String(alerta.valorLimite),
      severidade: alerta.severidade,
      ativo: alerta.ativo,
    });
    setModalAberto(true);
  };

  const salvarAlerta = async () => {
    const valorLimite = Number(formulario.valorLimite);

    if (!formulario.parametroId || !Number.isFinite(valorLimite)) {
      setErro('Selecione um parâmetro e informe um limite válido.');
      return;
    }

    try {
      setSalvando(true);
      setErro(null);

      if (alertaEditando) {
        await api(`/alertas/${alertaEditando.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            parametroId: formulario.parametroId,
            operador: formulario.operador,
            valorLimite,
            severidade: formulario.severidade,
            ativo: formulario.ativo,
          }),
        });
      } else {
        await api('/alertas', {
          method: 'POST',
          body: JSON.stringify({
            parametroId: formulario.parametroId,
            operador: formulario.operador,
            valorLimite,
            severidade: formulario.severidade,
          }),
        });
      }

      setModalAberto(false);
      await carregarAlertas();
    } catch (erroApi) {
      if (erroApi instanceof ErroApi) {
        if (erroApi.status === 401) {
          router.push('/login?proximo=/gerenciamento-de-alertas');
          return;
        }
        setErro(erroApi.message);
        return;
      }

      setErro('Não foi possível salvar o alerta.');
    } finally {
      setSalvando(false);
    }
  };

  const columns: Column<Alerta>[] = [
    {
      header: 'Alerta',
      key: 'id',
      render: (valor, alerta) => (
        <div>
          <p className="font-medium">
            {alerta.parametro.nome}
          </p>

          <p className="font-mono text-xs text-muted-foreground">
            {String(valor).slice(0, 8)}
          </p>
        </div>
      ),
    },

    {
      header: 'Estação',
      key: 'estacao',
      render: (_, alerta) => (
        <div>
          <p className="font-medium">
            {alerta.estacao.nome}
          </p>

          <p className="text-xs text-muted-foreground">
            {alerta.parametro.unidade}
          </p>
        </div>
      ),
    },

    {
      header: 'Operador',
      key: 'operador',
    },

    {
      header: 'Severidade',
      key: 'severidade',
      render: (valor) => {
        const severidade =
          valor as SeveridadeAlerta;

        return (
          <span
            className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${classeSeveridade(
              severidade,
            )}`}
          >
            {formatarSeveridade(
              severidade,
            )}
          </span>
        );
      },
    },

    {
      header: 'Limite',
      key: 'valorLimite',
      render: (valor, alerta) => (
        <span>
          {String(valor)} {alerta.parametro.unidade}
        </span>
      ),
    },

    {
      header: 'Status',
      key: 'ativo',
      render: (valor) => (
        <span
          className={
            valor
              ? 'inline-block rounded-full border border-green-500/30 bg-green-500/10 px-2.5 py-1 text-xs font-semibold text-green-600'
              : 'inline-block rounded-full border border-border bg-muted px-2.5 py-1 text-xs font-semibold text-muted-foreground'
          }
        >
          {valor ? 'Ativo' : 'Inativo'}
        </span>
      ),
    },

    {
      header: 'Criado em',
      key: 'criadoEm',
      render: (valor) =>
        formatarData(String(valor)),
    },

    {
      header: 'Ações',
      key: 'acoes',
      render: (_, alerta) => (
        <div className="flex items-center gap-1">
          <button
            type="button"
            className="rounded-md p-2 hover:bg-muted"
            onClick={() => abrirEdicao(alerta)}
            aria-label={`Editar alerta de ${alerta.parametro.nome}`}
            title="Editar alerta"
          >
            <Pencil className="h-4 w-4" />
          </button>

        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Alertas"
        description="Acompanhe e resolva ocorrências operacionais."
        action={(
          <Button type="button" onClick={abrirCadastro}>
            <Plus className="mr-2 h-4 w-4" />
            Novo alerta
          </Button>
        )}
      />

      <section className="rise delay-1 grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            Total de alertas
          </p>

          <p className="mt-2 font-display text-2xl font-semibold">
            {totalAlertas}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            ocorrências encontradas
          </p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            Emergências
          </p>

          <p className="mt-2 font-display text-2xl font-semibold">
            {quantidadeEmergencias}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            na página atual
          </p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            Ativos
          </p>

          <p className="mt-2 font-display text-2xl font-semibold">
            {quantidadeAtivos}
          </p>

          <p className="mt-1 text-xs text-muted-foreground">
            alertas ativos na página
          </p>
        </article>
      </section>

      {/* ==========================================
          FILTROS
          ========================================== */}

      <section className="rise delay-0 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {/* BUSCA */}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="search"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Buscar
          </label>

          <Input
            id="search"
            type="text"
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
            }}
            placeholder="ID, operador, estação..."
          />
        </div>

        {/* SEVERIDADE */}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="severidade"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Severidade
          </label>

          <select
            id="severidade"
            value={severidadeFilter}
            onChange={(e) => {
              setSeveridadeFilter(
                e.target.value as FiltroSeveridade,
              );
              setCurrentPage(1);
            }}
            className="rounded border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="TODOS">
              Todas as severidades
            </option>

            <option value="ATENCAO">
              Atenção
            </option>

            <option value="ALERTA">
              Alerta
            </option>

            <option value="EMERGENCIA">
              Emergência
            </option>
          </select>
        </div>

        {/* ESTAÇÃO */}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="estacao"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Estação
          </label>

          <select
            id="estacao"
            value={estacaoFilter}
            onChange={(e) => {
              setEstacaoFilter(
                e.target.value,
              );
              setCurrentPage(1);
            }}
            className="rounded border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">
              Todas as estações
            </option>

            {opcoesFiltro?.estacoes.map(
              (estacao) => (
                <option
                  key={estacao.id}
                  value={estacao.id}
                >
                  {estacao.nome}
                </option>
              ),
            )}
          </select>
        </div>

        {/* TIPO DE PARÂMETRO */}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="tipoParametro"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Parâmetro
          </label>

          <select
            id="tipoParametro"
            value={tipoParametroFilter}
            onChange={(e) => {
              setTipoParametroFilter(
                e.target.value,
              );
              setCurrentPage(1);
            }}
            className="rounded border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="">
              Todos os parâmetros
            </option>

            {opcoesFiltro?.tiposParametro.map(
              (tipo) => (
                <option
                  key={tipo.id}
                  value={tipo.id}
                >
                  {tipo.nome}
                </option>
              ),
            )}
          </select>
        </div>

        {/* STATUS */}

        <div className="flex flex-col gap-1">
          <label
            htmlFor="ativo"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Status
          </label>

          <select
            id="ativo"
            value={ativoFilter}
            onChange={(e) => {
              setAtivoFilter(
                e.target.value as
                  | 'TODOS'
                  | 'true'
                  | 'false',
              );
              setCurrentPage(1);
            }}
            className="rounded border border-border bg-card px-3 py-2 text-sm"
          >
            <option value="TODOS">
              Todos
            </option>

            <option value="true">
              Ativos
            </option>

            <option value="false">
              Inativos
            </option>
          </select>
        </div>

        {/* LIMPAR */}

        <div className="flex items-end">
          <Button
            type="button"
            variant="outline"
            onClick={limparFiltros}
            className="w-full"
          >
            Limpar filtros
          </Button>
        </div>
      </section>

      {/* ==========================================
          ERRO
          ========================================== */}

      {erro && (
        <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-600">
          {erro}
        </div>
      )}

      <DataTable<Alerta>
        columns={columns}
        data={alertasFiltrados}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        isLoading={carregando}
        rowKey="id"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 className="text-xl font-semibold">
                  {alertaEditando ? 'Editar alerta' : 'Cadastrar alerta'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Configure o parâmetro e a condição monitorada.
                </p>
              </div>

              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="alerta-parametro" className="text-sm font-medium">
                  Parâmetro monitorado
                </label>
                <select
                  id="alerta-parametro"
                  value={formulario.parametroId}
                  onChange={(event) =>
                    setFormulario((anterior) => ({
                      ...anterior,
                      parametroId: event.target.value,
                    }))
                  }
                  className="rounded border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="">Selecione um parâmetro</option>
                  {opcoesFiltro?.parametros.map((parametro) => (
                    <option key={parametro.id} value={parametro.id}>
                      {parametro.estacaoNome} · {parametro.nome} ({parametro.unidade})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="alerta-operador" className="text-sm font-medium">
                    Condição
                  </label>
                  <select
                    id="alerta-operador"
                    value={formulario.operador}
                    onChange={(event) =>
                      setFormulario((anterior) => ({
                        ...anterior,
                        operador: event.target.value as OperadorAlerta,
                      }))
                    }
                    className="rounded border border-border bg-card px-3 py-2 text-sm"
                  >
                    {OPERADORES.map((operador) => (
                      <option key={operador.valor} value={operador.valor}>
                        {operador.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="alerta-limite" className="text-sm font-medium">
                    Limite
                  </label>
                  <Input
                    id="alerta-limite"
                    type="number"
                    step="any"
                    value={formulario.valorLimite}
                    onChange={(event) =>
                      setFormulario((anterior) => ({
                        ...anterior,
                        valorLimite: event.target.value,
                      }))
                    }
                    placeholder="Ex.: 30"
                  />
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="alerta-severidade" className="text-sm font-medium">
                  Severidade
                </label>
                <select
                  id="alerta-severidade"
                  value={formulario.severidade}
                  onChange={(event) =>
                    setFormulario((anterior) => ({
                      ...anterior,
                      severidade: event.target.value as SeveridadeAlerta,
                    }))
                  }
                  className="rounded border border-border bg-card px-3 py-2 text-sm"
                >
                  <option value="ATENCAO">Atenção</option>
                  <option value="ALERTA">Alerta</option>
                  <option value="EMERGENCIA">Emergência</option>
                </select>
              </div>

              {alertaEditando && (
                <label className="flex items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={formulario.ativo}
                    onChange={(event) =>
                      setFormulario((anterior) => ({
                        ...anterior,
                        ativo: event.target.checked,
                      }))
                    }
                  />
                  Alerta ativo
                </label>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setModalAberto(false)}
                disabled={salvando}
              >
                Cancelar
              </Button>
              <Button type="button" onClick={() => void salvarAlerta()} disabled={salvando}>
                {salvando ? 'Salvando...' : 'Salvar alerta'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}