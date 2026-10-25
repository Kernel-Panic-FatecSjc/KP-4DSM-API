'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  api,
  ErroApi,
  type Paginado,
  type SensorApi,
  type SensorPayload,
  type UnidadeSensor,
} from '@/lib/api';
import { formatarFaixa, lerFaixa } from '@/lib/faixa-sensor';
import { ehTecsus, podeCadastrar } from '@/lib/perfil';
import { useCodigosLicitacao } from '@/lib/licitacoes';

const ITEMS_PER_PAGE = 10;
// Espera o usuário parar de digitar antes de consultar a API.
const ATRASO_BUSCA_MS = 300;

type FormularioSensor = {
  nome: string;
  unidade: string;
  fator: string;
  ganho: string;
  valorMinimo: string;
  valorMaximo: string;
};

// Fator 1 e ganho 0 deixam a leitura bruta inalterada, o ponto de partida
// natural para um sensor que ainda não passou por calibração.
const FORMULARIO_INICIAL: FormularioSensor = {
  nome: '',
  unidade: '',
  fator: '1',
  ganho: '0',
  valorMinimo: '',
  valorMaximo: '',
};

export default function SensoresPage() {
  const router = useRouter();
  const usuario = useUsuario();
  const tecsus = ehTecsus(usuario);
  const podeEditar = podeCadastrar(usuario);
  const codigosLicitacao = useCodigosLicitacao(tecsus);

  const [lista, setLista] = useState<Paginado<SensorApi> | null>(null);
  const [unidades, setUnidades] = useState<UnidadeSensor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [licitacaoFiltro, setLicitacaoFiltro] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  // Incrementado depois de salvar ou excluir, para reconsultar a página atual.
  const [recarga, setRecarga] = useState(0);
  const ultimaConsulta = useRef(0);

  const [modalAberto, setModalAberto] = useState(false);
  const [sensorEditando, setSensorEditando] = useState<SensorApi | null>(null);
  const [formulario, setFormulario] = useState<FormularioSensor>(FORMULARIO_INICIAL);
  const [licitacaoFormulario, setLicitacaoFormulario] = useState('');
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [salvando, setSalvando] = useState(false);

  const [sensorExcluindo, setSensorExcluindo] = useState<SensorApi | null>(null);
  const [excluindo, setExcluindo] = useState(false);

  const tratarErro = useCallback(
    (erroCapturado: unknown, padrao: string): string | null => {
      if (erroCapturado instanceof ErroApi) {
        if (erroCapturado.status === 401) {
          router.replace('/login?proximo=/sensores');
          return null;
        }
        return erroCapturado.message;
      }
      console.error(erroCapturado);
      return padrao;
    },
    [router],
  );

  const carregarSensores = useCallback(async () => {
    const consulta = ++ultimaConsulta.current;
    setCarregando(true);
    setErro(null);

    const parametros = new URLSearchParams({ pagina: String(currentPage), tamanho: String(ITEMS_PER_PAGE) });
    if (buscaAplicada) parametros.set('busca', buscaAplicada);
    if (licitacaoFiltro) parametros.set('licitacaoId', licitacaoFiltro);

    try {
      const resposta = await api<Paginado<SensorApi>>(`/sensores?${parametros}`);
      // Uma consulta mais nova (ex.: busca digitada) já está a caminho.
      if (consulta !== ultimaConsulta.current) return;
      setLista(resposta);
    } catch (erroCapturado) {
      if (consulta !== ultimaConsulta.current) return;
      setErro(tratarErro(erroCapturado, 'Não foi possível carregar os sensores.'));
    } finally {
      if (consulta === ultimaConsulta.current) setCarregando(false);
    }
  }, [tratarErro, currentPage, buscaAplicada, licitacaoFiltro]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca a listagem ao montar a página e ao mudar o filtro
    void carregarSensores();
    // recarga não é lida aqui: só refaz a consulta depois de salvar ou excluir.
  }, [carregarSensores, recarga]);

  useEffect(() => {
    api<UnidadeSensor[]>('/sensores/unidades')
      .then(setUnidades)
      .catch((erroCapturado: unknown) => setErro(tratarErro(erroCapturado, 'Não foi possível carregar as unidades de medida.')));
  }, [tratarErro]);

  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscaAplicada(searchTerm.trim());
      setCurrentPage(1);
    }, ATRASO_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [searchTerm]);

  const sensores = useMemo(() => lista?.itens ?? [], [lista]);

  // A API pagina: só o total é da consulta inteira; o uso é contado na página.
  const stats = useMemo(() => {
    const emUso = sensores.filter((sensor) => sensor.estacoesAssociadas > 0).length;
    return { total: lista?.total ?? 0, emUso, semEstacao: sensores.length - emUso };
  }, [lista, sensores]);

  // Agrupa o catálogo por grandeza para o <optgroup>, mantendo a ordem do back.
  const unidadesPorGrandeza = useMemo(() => {
    const grupos = new Map<string, UnidadeSensor[]>();
    for (const unidade of unidades) {
      grupos.set(unidade.grandeza, [...(grupos.get(unidade.grandeza) ?? []), unidade]);
    }
    return [...grupos.entries()];
  }, [unidades]);

  // Sensores cadastrados antes do catálogo podem ter unidade fora dele; a
  // opção extra evita que o select mostre outra unidade como selecionada.
  const unidadeForaDoCatalogo =
    formulario.unidade !== '' && !unidades.some((unidade) => unidade.valor === formulario.unidade)
      ? formulario.unidade
      : null;

  const totalPages = lista ? Math.max(1, Math.ceil(lista.total / lista.tamanho)) : 1;

  const abrirCadastro = () => {
    setSensorEditando(null);
    setFormulario(FORMULARIO_INICIAL);
    // Quem já filtrou uma licitação provavelmente vai cadastrar nela.
    setLicitacaoFormulario(licitacaoFiltro);
    setErroFormulario(null);
    setModalAberto(true);
  };

  const abrirEdicao = (sensor: SensorApi) => {
    setSensorEditando(sensor);
    setFormulario({
      nome: sensor.nome,
      unidade: sensor.unidade,
      fator: String(sensor.fator),
      ganho: String(sensor.ganho),
      valorMinimo: sensor.valorMinimo == null ? '' : String(sensor.valorMinimo),
      valorMaximo: sensor.valorMaximo == null ? '' : String(sensor.valorMaximo),
    });
    setErroFormulario(null);
    setModalAberto(true);
  };

  const fecharModal = () => {
    if (salvando) return;
    setModalAberto(false);
    setSensorEditando(null);
  };

  async function salvarSensor(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();

    const nome = formulario.nome.trim();
    const unidade = formulario.unidade.trim();
    const fator = Number(formulario.fator.replace(',', '.'));
    const ganho = Number(formulario.ganho.replace(',', '.'));

    if (!nome || !unidade) {
      setErroFormulario('Informe o nome e selecione a unidade de medida do sensor.');
      return;
    }

    if (!sensorEditando && tecsus && !licitacaoFormulario) {
      setErroFormulario('Selecione a licitação do sensor.');
      return;
    }

    if (formulario.fator.trim() === '' || !Number.isFinite(fator)) {
      setErroFormulario('Informe um fator numérico válido.');
      return;
    }

    if (fator === 0) {
      setErroFormulario('O fator não pode ser zero, pois anularia todas as leituras.');
      return;
    }

    if (formulario.ganho.trim() === '' || !Number.isFinite(ganho)) {
      setErroFormulario('Informe um ganho numérico válido.');
      return;
    }

    const faixa = lerFaixa(formulario.valorMinimo, formulario.valorMaximo);
    if ('erro' in faixa) {
      setErroFormulario(faixa.erro);
      return;
    }

    const payload: SensorPayload = {
      nome,
      unidade,
      fator,
      ganho,
      valorMinimo: faixa.minimo,
      valorMaximo: faixa.maximo,
    };

    setSalvando(true);
    setErroFormulario(null);

    try {
      if (sensorEditando) {
        // Envia só o que mudou: a auditoria registra os campos informados, e
        // uma unidade antiga fora do catálogo não é revalidada se ficar igual.
        const alteracoes = Object.fromEntries(
          Object.entries(payload).filter(
            ([campo, valor]) => sensorEditando[campo as keyof SensorPayload] !== valor,
          ),
        );

        if (Object.keys(alteracoes).length === 0) {
          setModalAberto(false);
          setSensorEditando(null);
          return;
        }

        await api<SensorApi>(`/sensores/${sensorEditando.id}`, {
          method: 'PATCH',
          body: JSON.stringify(alteracoes),
        });
      } else {
        // O admin da licitação omite: o backend usa a licitação dele.
        await api<SensorApi>('/sensores', {
          method: 'POST',
          body: JSON.stringify(tecsus ? { ...payload, licitacaoId: licitacaoFormulario } : payload),
        });
        setCurrentPage(1);
      }
      setRecarga((atual) => atual + 1);
      setModalAberto(false);
      setSensorEditando(null);
    } catch (erroCapturado) {
      setErroFormulario(tratarErro(erroCapturado, 'Não foi possível salvar o sensor.'));
    } finally {
      setSalvando(false);
    }
  }

  async function excluirSensor() {
    if (!sensorExcluindo) return;

    setExcluindo(true);
    setErro(null);

    try {
      await api(`/sensores/${sensorExcluindo.id}`, { method: 'DELETE' });
      setSensorExcluindo(null);
      setRecarga((atual) => atual + 1);
    } catch (erroCapturado) {
      setErro(tratarErro(erroCapturado, 'Não foi possível excluir o sensor.'));
      setSensorExcluindo(null);
    } finally {
      setExcluindo(false);
    }
  }

  const colunaLicitacao: Column<SensorApi> = {
    header: 'Licitação',
    key: 'licitacaoId',
    className: 'whitespace-nowrap font-mono text-xs',
    render: (licitacaoId) => codigosLicitacao.get(String(licitacaoId)) ?? String(licitacaoId).slice(0, 8),
  };

  const colunaAcoes: Column<SensorApi> = {
    header: 'Ações',
    key: 'id',
    render: (_, sensor) => (
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => abrirEdicao(sensor)}
          className="text-xs font-medium text-aqua hover:underline"
        >
          Editar
        </button>
        <button
          type="button"
          onClick={() => setSensorExcluindo(sensor)}
          disabled={sensor.estacoesAssociadas > 0}
          title={
            sensor.estacoesAssociadas > 0
              ? 'Remova o sensor das estações antes de excluí-lo'
              : undefined
          }
          className="text-xs font-medium text-destructive hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
        >
          Excluir
        </button>
      </div>
    ),
  };

  const columns: Column<SensorApi>[] = [
    {
      header: 'Sensor',
      key: 'nome',
      render: (_, sensor) => (
        <div>
          <p className="font-medium">{sensor.nome}</p>
          <p className="font-mono text-xs text-muted-foreground">{sensor.id.slice(0, 8)}</p>
        </div>
      ),
    },
    ...(tecsus ? [colunaLicitacao] : []),
    {
      header: 'Unidade',
      key: 'unidade',
      render: (unidade) => (
        <span className="rounded-md bg-muted px-2 py-1 font-mono text-xs">{String(unidade)}</span>
      ),
    },
    { header: 'Fator', key: 'fator', className: 'font-mono text-xs' },
    { header: 'Ganho', key: 'ganho', className: 'font-mono text-xs' },
    {
      header: 'Faixa válida',
      key: 'valorMinimo',
      className: 'font-mono text-xs',
      render: (_, sensor) => formatarFaixa(sensor.valorMinimo, sensor.valorMaximo),
    },
    {
      header: 'Estações',
      key: 'estacoesAssociadas',
      render: (quantidade) => {
        const total = Number(quantidade);
        return (
          <span
            className={`inline-block px-2.5 py-1 rounded-full text-xs font-semibold border ${total > 0 ? 'bg-lime/10 border-lime/30 text-lime' : 'bg-muted border-border text-muted-foreground'}`}
          >
            {total > 0 ? `${total} ${total === 1 ? 'estação' : 'estações'}` : 'Sem estação'}
          </span>
        );
      },
    },
    ...(podeEditar ? [colunaAcoes] : []),
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Sensores"
        description="Cadastre os tipos de sensores e a calibração aplicada às leituras."
        action={
          podeEditar ? (
            <Button type="button" onClick={abrirCadastro}>
              <Plus />
              Novo sensor
            </Button>
          ) : undefined
        }
      />

      <section className="rise delay-1 grid gap-3 sm:grid-cols-3">
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Total de sensores</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">tipos cadastrados</p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Em uso</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats.emUso}</p>
          <p className="mt-1 text-xs text-muted-foreground">associados a estações, nesta página</p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Sem estação</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats.semEstacao}</p>
          <p className="mt-1 text-xs text-muted-foreground">disponíveis para associação, nesta página</p>
        </article>
      </section>

      {erro && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          <p>{erro}</p>
          <Button type="button" variant="outline" size="sm" onClick={() => void carregarSensores()}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section className="rise delay-1 grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label htmlFor="buscaSensor" className="font-mono text-[10px] uppercase text-muted-foreground">
            Buscar
          </label>
          <Input
            id="buscaSensor"
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Buscar por nome..."
          />
        </div>

        {tecsus && (
          <div className="flex flex-col gap-1">
            <label htmlFor="licitacaoSensor" className="font-mono text-[10px] uppercase text-muted-foreground">
              Licitação
            </label>
            <SeletorLicitacao
              id="licitacaoSensor"
              valor={licitacaoFiltro}
              onChange={(licitacaoId) => { setLicitacaoFiltro(licitacaoId); setCurrentPage(1); }}
              rotuloTodas="Todas as licitações"
            />
          </div>
        )}
      </section>

      <DataTable<SensorApi>
        columns={columns}
        data={sensores}
        currentPage={lista?.pagina ?? currentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        isLoading={carregando}
        rowKey="id"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={salvarSensor}
            className="max-h-[calc(100dvh-2rem)] w-full max-w-lg overflow-y-auto rounded-xl bg-card p-4 shadow-xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-sensor"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="titulo-modal-sensor" className="text-xl font-semibold">
                  {sensorEditando ? 'Editar sensor' : 'Cadastrar sensor'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  {sensorEditando
                    ? 'As alterações valem para todas as estações que usam este sensor.'
                    : 'Depois de cadastrado, o sensor pode ser associado às estações.'}
                </p>
              </div>

              <button
                type="button"
                onClick={fecharModal}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Fechar modal"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4">
              {tecsus && !sensorEditando && (
                <div className="flex flex-col gap-1">
                  <label htmlFor="sensor-licitacao" className="text-sm font-medium">
                    Licitação
                  </label>
                  <SeletorLicitacao id="sensor-licitacao" valor={licitacaoFormulario} onChange={setLicitacaoFormulario} />
                  <p className="text-xs text-muted-foreground">
                    O sensor só pode ser associado às estações desta licitação.
                  </p>
                </div>
              )}

              {tecsus && sensorEditando && (
                <p className="text-sm text-muted-foreground">
                  Licitação:{' '}
                  <span className="font-mono text-foreground">
                    {codigosLicitacao.get(sensorEditando.licitacaoId) ?? sensorEditando.licitacaoId}
                  </span>
                </p>
              )}

              <div className="grid gap-4 sm:grid-cols-[1fr_200px]">
                <div className="flex flex-col gap-1">
                  <label htmlFor="sensor-nome" className="text-sm font-medium">
                    Nome
                  </label>
                  <Input
                    id="sensor-nome"
                    required
                    maxLength={120}
                    value={formulario.nome}
                    onChange={(e) => setFormulario((anterior) => ({ ...anterior, nome: e.target.value }))}
                    placeholder="Ex.: Pluviômetro"
                    autoFocus
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="sensor-unidade" className="text-sm font-medium">
                    Unidade
                  </label>
                  <Select
                    id="sensor-unidade"
                    required
                    value={formulario.unidade}
                    onChange={(e) => setFormulario((anterior) => ({ ...anterior, unidade: e.target.value }))}
                  >
                    <option value="" disabled>
                      Selecione
                    </option>
                    {unidadeForaDoCatalogo && (
                      <option value={unidadeForaDoCatalogo}>{unidadeForaDoCatalogo} (fora do catálogo)</option>
                    )}
                    {unidadesPorGrandeza.map(([grandeza, opcoes]) => (
                      <optgroup key={grandeza} label={grandeza}>
                        {opcoes.map((unidade) => (
                          <option key={unidade.valor} value={unidade.valor}>
                            {unidade.valor} · {unidade.nome}
                          </option>
                        ))}
                      </optgroup>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="sensor-fator" className="text-sm font-medium">
                    Fator
                  </label>
                  <Input
                    id="sensor-fator"
                    type="number"
                    step="any"
                    required
                    value={formulario.fator}
                    onChange={(e) => setFormulario((anterior) => ({ ...anterior, fator: e.target.value }))}
                    placeholder="1"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="sensor-ganho" className="text-sm font-medium">
                    Ganho
                  </label>
                  <Input
                    id="sensor-ganho"
                    type="number"
                    step="any"
                    required
                    value={formulario.ganho}
                    onChange={(e) => setFormulario((anterior) => ({ ...anterior, ganho: e.target.value }))}
                    placeholder="0"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Fator e ganho calibram a leitura bruta enviada pelo datalogger. Use fator 1 e ganho 0
                para manter o valor original.
              </p>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="sensor-valor-minimo" className="text-sm font-medium">
                    Valor mínimo (opcional)
                  </label>
                  <Input
                    id="sensor-valor-minimo"
                    type="number"
                    step="any"
                    value={formulario.valorMinimo}
                    onChange={(e) => setFormulario((anterior) => ({ ...anterior, valorMinimo: e.target.value }))}
                    placeholder="Sem limite"
                  />
                </div>

                <div className="flex flex-col gap-1">
                  <label htmlFor="sensor-valor-maximo" className="text-sm font-medium">
                    Valor máximo (opcional)
                  </label>
                  <Input
                    id="sensor-valor-maximo"
                    type="number"
                    step="any"
                    value={formulario.valorMaximo}
                    onChange={(e) => setFormulario((anterior) => ({ ...anterior, valorMaximo: e.target.value }))}
                    placeholder="Sem limite"
                  />
                </div>
              </div>

              <p className="text-xs text-muted-foreground">
                Faixa física válida da leitura (limites inclusivos). Leitura fora dela não é gravada como
                medida e fica registrada como erro de leitura.
              </p>

              {erroFormulario && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erroFormulario}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={fecharModal} disabled={salvando}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : sensorEditando ? 'Salvar alterações' : 'Cadastrar sensor'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {sensorExcluindo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-exclusao-sensor"
          >
            <h2 id="titulo-exclusao-sensor" className="text-lg font-semibold">
              Excluir sensor
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Tem certeza que deseja excluir o sensor <strong>{sensorExcluindo.nome}</strong>? Esta ação
              não pode ser desfeita.
            </p>

            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setSensorExcluindo(null)}
                disabled={excluindo}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={() => void excluirSensor()}
                disabled={excluindo}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                {excluindo ? 'Excluindo...' : 'Excluir'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
