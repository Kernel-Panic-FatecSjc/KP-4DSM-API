'use client';

import { Plus, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { api, ErroApi, type SensorApi, type SensorPayload, type UnidadeSensor } from '@/lib/api';

const ITEMS_PER_PAGE = 10;

type FiltroUso = 'TODOS' | 'EM_USO' | 'SEM_ESTACAO';

type FormularioSensor = {
  nome: string;
  unidade: string;
  fator: string;
  ganho: string;
};

// Fator 1 e ganho 0 deixam a leitura bruta inalterada, o ponto de partida
// natural para um sensor que ainda não passou por calibração.
const FORMULARIO_INICIAL: FormularioSensor = {
  nome: '',
  unidade: '',
  fator: '1',
  ganho: '0',
};

export default function SensoresPage() {
  const router = useRouter();

  const [sensores, setSensores] = useState<SensorApi[]>([]);
  const [unidades, setUnidades] = useState<UnidadeSensor[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [usoFilter, setUsoFilter] = useState<FiltroUso>('TODOS');
  const [currentPage, setCurrentPage] = useState(1);

  const [modalAberto, setModalAberto] = useState(false);
  const [sensorEditando, setSensorEditando] = useState<SensorApi | null>(null);
  const [formulario, setFormulario] = useState<FormularioSensor>(FORMULARIO_INICIAL);
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
    setCarregando(true);
    setErro(null);

    try {
      const [lista, catalogo] = await Promise.all([
        api<SensorApi[]>('/sensores'),
        api<UnidadeSensor[]>('/sensores/unidades'),
      ]);
      setSensores(lista);
      setUnidades(catalogo);
    } catch (erroCapturado) {
      setErro(tratarErro(erroCapturado, 'Não foi possível carregar os sensores.'));
    } finally {
      setCarregando(false);
    }
  }, [tratarErro]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca a listagem ao montar a página
    void carregarSensores();
  }, [carregarSensores]);

  const sensoresFiltrados = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return sensores.filter((sensor) => {
      const matchesSearch =
        !query ||
        sensor.nome.toLowerCase().includes(query) ||
        sensor.unidade.toLowerCase().includes(query);

      const matchesUso =
        usoFilter === 'TODOS' ||
        (usoFilter === 'EM_USO' && sensor.estacoesAssociadas > 0) ||
        (usoFilter === 'SEM_ESTACAO' && sensor.estacoesAssociadas === 0);

      return matchesSearch && matchesUso;
    });
  }, [sensores, searchTerm, usoFilter]);

  const stats = useMemo(() => {
    const total = sensores.length;
    const emUso = sensores.filter((sensor) => sensor.estacoesAssociadas > 0).length;
    return { total, emUso, semEstacao: total - emUso };
  }, [sensores]);

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

  const totalPages = Math.max(1, Math.ceil(sensoresFiltrados.length / ITEMS_PER_PAGE));
  const safeCurrentPage = Math.min(currentPage, totalPages);
  const paginatedSensores = useMemo(() => {
    const start = (safeCurrentPage - 1) * ITEMS_PER_PAGE;
    return sensoresFiltrados.slice(start, start + ITEMS_PER_PAGE);
  }, [sensoresFiltrados, safeCurrentPage]);

  const abrirCadastro = () => {
    setSensorEditando(null);
    setFormulario(FORMULARIO_INICIAL);
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

    const payload: SensorPayload = { nome, unidade, fator, ganho };

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

        const atualizado = await api<SensorApi>(`/sensores/${sensorEditando.id}`, {
          method: 'PATCH',
          body: JSON.stringify(alteracoes),
        });
        setSensores((atual) => atual.map((s) => (s.id === atualizado.id ? atualizado : s)));
      } else {
        const criado = await api<SensorApi>('/sensores', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
        setSensores((atual) =>
          [...atual, criado].sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
        );
        setCurrentPage(1);
      }
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
      setSensores((atual) => atual.filter((s) => s.id !== sensorExcluindo.id));
      setSensorExcluindo(null);
    } catch (erroCapturado) {
      setErro(tratarErro(erroCapturado, 'Não foi possível excluir o sensor.'));
      setSensorExcluindo(null);
    } finally {
      setExcluindo(false);
    }
  }

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
    {
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
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Sensores"
        description="Cadastre os tipos de sensores e a calibração aplicada às leituras."
        action={
          <Button type="button" onClick={abrirCadastro}>
            <Plus />
            Novo sensor
          </Button>
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
          <p className="mt-1 text-xs text-muted-foreground">associados a estações</p>
        </article>

        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Sem estação</p>
          <p className="mt-2 font-display text-2xl font-semibold">{stats.semEstacao}</p>
          <p className="mt-1 text-xs text-muted-foreground">disponíveis para associação</p>
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
            onChange={(e) => { setSearchTerm(e.target.value); setCurrentPage(1); }}
            placeholder="Buscar por nome ou unidade..."
          />
        </div>

        <div className="flex flex-col gap-1">
          <label htmlFor="usoSensor" className="font-mono text-[10px] uppercase text-muted-foreground">
            Uso
          </label>
          <select
            id="usoSensor"
            value={usoFilter}
            onChange={(e) => { setUsoFilter(e.target.value as FiltroUso); setCurrentPage(1); }}
            className="h-9 rounded-md border border-input bg-card px-3 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="TODOS">Todos os sensores</option>
            <option value="EM_USO">Em uso</option>
            <option value="SEM_ESTACAO">Sem estação</option>
          </select>
        </div>
      </section>

      <DataTable<SensorApi>
        columns={columns}
        data={paginatedSensores}
        currentPage={safeCurrentPage}
        totalPages={totalPages}
        onPageChange={setCurrentPage}
        isLoading={carregando}
        rowKey="id"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={salvarSensor}
            className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl"
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

              {erroFormulario && (
                <div className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erroFormulario}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
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

            <div className="mt-6 flex justify-end gap-3">
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
