'use client';

import { createPortal } from 'react-dom';
import { useEffect, useMemo, useState,} from 'react';
import { MoreHorizontal, Plus, Search, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import {
  api,
  ErroApi,
  type AtualizarEstacaoPayload,
  type CriarEstacaoPayload,
  type EstacaoApi,
} from '@/lib/api';
import { PageHeading } from '@/components/PageHeading';
import { DataTable, type Column } from '@/components/DataTable';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';

type Sensor = {
  id: string;
  nome: string;
  tipo: string;
  unidade: string;
};

type Estacao = {
  id: string;
  nome: string;
  codigo: string;
  latitude: number;
  longitude: number;
  status: 'Ativo' | 'Não Ativo';
  endereco: string;
  sensores: Sensor[];
};

const ITEMS_PER_PAGE = 5;

/*
 * IMPORTANTE:
 * Esses sensores são apenas um exemplo enquanto você não possui
 * um endpoint para listar os tipos de parâmetro.
 *
 * Os IDs precisam ser UUIDs que realmente existam no banco.
 *
 * Quando você tiver um GET /tipos-parametro, substituímos esta
 * constante por uma chamada à API.
 */
const SENSORES_DISPONIVEIS: Sensor[] = [
  {
    id: '11111111-1111-4111-8111-111111111111',
    nome: 'Temperatura',
    tipo: 'Temperatura',
    unidade: '°C',
  },
  {
    id: '22222222-2222-4222-8222-222222222222',
    nome: 'Umidade',
    tipo: 'Umidade',
    unidade: '%',
  },
  {
    id: '33333333-3333-4333-8333-333333333333',
    nome: 'Chuva',
    tipo: 'Chuva',
    unidade: 'mm',
  },
  {
    id: '44444444-4444-4444-8444-444444444444',
    nome: 'Vento',
    tipo: 'Vento',
    unidade: 'km/h',
  },
];

export default function EstacoesPage() {
  const router = useRouter();

  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [carregando, setCarregando] = useState(true);

  const [busca, setBusca] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);

  const [modalCadastroAberto, setModalCadastroAberto] =
    useState(false);

  const [modalSensoresAberto, setModalSensoresAberto] =
    useState(false);

  const [modalEdicaoAberto, setModalEdicaoAberto] =
    useState(false);

  const [modalExclusaoAberto, setModalExclusaoAberto] =
    useState(false);

  const [estacaoSelecionada, setEstacaoSelecionada] =
    useState<Estacao | null>(null);

  const [menuAbertoCodigo, setMenuAbertoCodigo] =
    useState<string | null>(null);

  const [posicaoMenu, setPosicaoMenu] = useState<{
    top: number;
    left: number;
  } | null>(null);

  const [nome, setNome] = useState('');
  const [vid, setVid] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [endereco, setEndereco] = useState('');

  const [sensoresSelecionados, setSensoresSelecionados] =
    useState<Sensor[]>([]);

  useEffect(() => {
    api<EstacaoApi[]>('/estacoes')
      .then((resposta) => {
        const estacoesConvertidas: Estacao[] = resposta.map(
          (estacao) => ({
            id: estacao.id,
            nome: estacao.nome,
            codigo: estacao.vid,
            latitude: estacao.latitude,
            longitude: estacao.longitude,
            status:
              estacao.statusOperacional === 'ATIVA'
                ? 'Ativo'
                : 'Não Ativo',
            endereco: estacao.endereco,
            sensores: estacao.sensores.map((sensor) => ({
              id: sensor.id,
              nome: sensor.nome,
              tipo: sensor.nome,
              unidade: sensor.unidade,
            })),
          }),
        );

        setEstacoes(estacoesConvertidas);
      })
      .catch((erro: unknown) => {
        if (erro instanceof ErroApi) {
          if (erro.status === 401) {
            router.push('/login?proximo=/estacoes');
            return;
          }

          alert(erro.message);
          return;
        }

        console.error(erro);
        alert('Não foi possível carregar as estações.');
      })
      .finally(() => {
        setCarregando(false);
      });
  }, [router]);

  const estacoesFiltradas = useMemo(() => {
    const termo = busca.trim().toLowerCase();

    if (!termo) {
      return estacoes;
    }

    return estacoes.filter((estacao) => {
      return (
        estacao.nome.toLowerCase().includes(termo) ||
        estacao.codigo.toLowerCase().includes(termo) ||
        estacao.endereco.toLowerCase().includes(termo)
      );
    });
  }, [estacoes, busca]);

  const totalPaginas = Math.max(
    1,
    Math.ceil(
      estacoesFiltradas.length / ITEMS_PER_PAGE,
    ),
  );

  const paginaSegura = Math.min(
    paginaAtual,
    totalPaginas,
  );

  const estacoesPagina = useMemo(() => {
    const inicio =
      (paginaSegura - 1) * ITEMS_PER_PAGE;

    return estacoesFiltradas.slice(
      inicio,
      inicio + ITEMS_PER_PAGE,
    );
  }, [
    estacoesFiltradas,
    paginaSegura,
  ]);

  const limparFormulario = () => {
    setNome('');
    setVid('');
    setLatitude('');
    setLongitude('');
    setEndereco('');
    setSensoresSelecionados([]);
    setEstacaoSelecionada(null);
  };

  const abrirModalCadastro = () => {
    limparFormulario();
    setModalCadastroAberto(true);
  };

  const cadastrarEstacao = async () => {
    try {
      if (!nome.trim()) {
        alert('Informe o nome da estação.');
        return;
      }

      if (!endereco.trim()) {
        alert('Informe o endereço ou região.');
        return;
      }

      if (!vid.trim()) {
        alert('Informe o UUID/MAC da estação.');
        return;
      }

      if (!latitude.trim()) {
        alert('Informe a latitude.');
        return;
      }

      if (!longitude.trim()) {
        alert('Informe a longitude.');
        return;
      }

      const latitudeNumero = Number(latitude);
      const longitudeNumero = Number(longitude);

      if (!Number.isFinite(latitudeNumero)) {
        alert('Informe uma latitude válida.');
        return;
      }

      if (!Number.isFinite(longitudeNumero)) {
        alert('Informe uma longitude válida.');
        return;
      }

      if (
        latitudeNumero < -90 ||
        latitudeNumero > 90
      ) {
        alert('A latitude deve estar entre -90 e 90.');
        return;
      }

      if (
        longitudeNumero < -180 ||
        longitudeNumero > 180
      ) {
        alert(
          'A longitude deve estar entre -180 e 180.',
        );
        return;
      }

      const payload: CriarEstacaoPayload = {
        nome: nome.trim(),
        endereco: endereco.trim(),
        vid: vid.trim(),
        latitude: latitudeNumero,
        longitude: longitudeNumero,
        tipoParametroIds:
          sensoresSelecionados.map(
            (sensor) => sensor.id,
          ),
      };

      const novaEstacaoApi =
        await api<EstacaoApi>('/estacoes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

      const novaEstacao: Estacao = {
        id: novaEstacaoApi.id,
        nome: novaEstacaoApi.nome,
        codigo: novaEstacaoApi.vid,
        latitude: novaEstacaoApi.latitude,
        longitude: novaEstacaoApi.longitude,
        status:
          novaEstacaoApi.statusOperacional === 'ATIVA'
            ? 'Ativo'
            : 'Não Ativo',
        endereco: novaEstacaoApi.endereco,
        sensores: novaEstacaoApi.sensores.map(
          (sensor) => ({
            id: sensor.id,
            nome: sensor.nome,
            tipo: sensor.nome,
            unidade: sensor.unidade,
          }),
        ),
      };

      setEstacoes((anteriores) => [
        ...anteriores,
        novaEstacao,
      ]);

      setModalCadastroAberto(false);
      limparFormulario();
      setPaginaAtual(1);

      alert('Estação cadastrada com sucesso!');
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.status === 401) {
          router.push('/login?proximo=/estacoes');
          return;
        }

        alert(erro.message);
        return;
      }

      console.error(erro);
      alert('Não foi possível cadastrar a estação.');
    }
  };

  const abrirMenu = (
    event: React.MouseEvent<HTMLButtonElement>,
    codigo: string,
  ) => {
    if (menuAbertoCodigo === codigo) {
      setMenuAbertoCodigo(null);
      return;
    }

    const retangulo =
      event.currentTarget.getBoundingClientRect();

    const larguraMenu = 160;

    setPosicaoMenu({
      top: retangulo.bottom + 4,
      left: Math.max(
        8,
        Math.min(
          retangulo.right - larguraMenu,
          window.innerWidth -
            larguraMenu -
            8,
        ),
      ),
    });

    setMenuAbertoCodigo(codigo);
  };

  const abrirModalEdicao = (estacao: Estacao) => {
    setMenuAbertoCodigo(null);

    setEstacaoSelecionada(estacao);

    setNome(estacao.nome);
    setVid(estacao.codigo);
    setLatitude(String(estacao.latitude));
    setLongitude(String(estacao.longitude));
    setEndereco(estacao.endereco);
    setSensoresSelecionados(estacao.sensores);

    setModalEdicaoAberto(true);
  };

  const confirmarExclusao = (codigo: string) => {
    const estacao = estacoes.find(
      (item) => item.codigo === codigo,
    );

    if (!estacao) {
      return;
    }

    setMenuAbertoCodigo(null);
    setEstacaoSelecionada(estacao);
    setModalExclusaoAberto(true);
  };

  const atualizarStatusEstacao = async (
    estacao: Estacao,
    statusOperacional: AtualizarEstacaoPayload['statusOperacional'],
  ) => {
    try {
      await api<EstacaoApi | { mensagem: string }>(
        `/estacoes/${estacao.id}`,
        statusOperacional === 'ATIVA'
          ? {
              method: 'PATCH',
              body: JSON.stringify({ statusOperacional }),
            }
          : { method: 'DELETE' },
      );

      setEstacoes((anteriores) =>
        anteriores.map((item) =>
          item.id === estacao.id
            ? {
                ...item,
                status:
                  statusOperacional === 'ATIVA'
                    ? 'Ativo'
                    : 'Não Ativo',
              }
            : item,
        ),
      );

      setMenuAbertoCodigo(null);
      alert(
        statusOperacional === 'ATIVA'
          ? 'Estação ativada com sucesso!'
          : 'Estação inativada com sucesso!',
      );
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.status === 401) {
          router.push('/login?proximo=/estacoes');
          return;
        }

        alert(erro.message);
        return;
      }

      console.error(erro);
      alert(
        statusOperacional === 'ATIVA'
          ? 'Não foi possível ativar a estação.'
          : 'Não foi possível inativar a estação.',
      );
    }
  };

  const excluirEstacao = async () => {
    if (!estacaoSelecionada) {
      return;
    }

    setModalExclusaoAberto(false);
    await atualizarStatusEstacao(estacaoSelecionada, 'INATIVA');
    setEstacaoSelecionada(null);
  };

  const salvarEdicao = async () => {
    if (!estacaoSelecionada) {
      return;
    }

    const latitudeNumero = Number(latitude);
    const longitudeNumero = Number(longitude);

    if (!nome.trim()) {
      alert('Informe o nome da estação.');
      return;
    }

    if (!endereco.trim()) {
      alert('Informe o endereço.');
      return;
    }

    if (!vid.trim()) {
      alert('Informe o UUID/MAC da estação.');
      return;
    }

    if (!Number.isFinite(latitudeNumero)) {
      alert('Informe uma latitude válida.');
      return;
    }

    if (!Number.isFinite(longitudeNumero)) {
      alert('Informe uma longitude válida.');
      return;
    }

    try {
      const payload: AtualizarEstacaoPayload = {
        nome: nome.trim(),
        endereco: endereco.trim(),
        vid: vid.trim(),
        latitude: latitudeNumero,
        longitude: longitudeNumero,
        tipoParametroIds: sensoresSelecionados.map(
          (sensor) => sensor.id,
        ),
      };

      const estacaoAtualizada = await api<EstacaoApi>(
        `/estacoes/${estacaoSelecionada.id}`,
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        },
      );

      const estacaoConvertida: Estacao = {
        id: estacaoAtualizada.id,
        nome: estacaoAtualizada.nome,
        codigo: estacaoAtualizada.vid,
        latitude: estacaoAtualizada.latitude,
        longitude: estacaoAtualizada.longitude,
        status:
          estacaoAtualizada.statusOperacional === 'ATIVA'
            ? 'Ativo'
            : 'Não Ativo',
        endereco: estacaoAtualizada.endereco,
        sensores: estacaoAtualizada.sensores.map(
          (sensor) => ({
            id: sensor.id,
            nome: sensor.nome,
            tipo: sensor.nome,
            unidade: sensor.unidade,
          }),
        ),
      };

      setEstacoes((anteriores) =>
        anteriores.map((estacao) =>
          estacao.id === estacaoAtualizada.id
            ? estacaoConvertida
            : estacao,
        ),
      );

      setModalEdicaoAberto(false);
      limparFormulario();
      alert('Estação atualizada com sucesso!');
    } catch (erro) {
      if (erro instanceof ErroApi) {
        if (erro.status === 401) {
          router.push('/login?proximo=/estacoes');
          return;
        }

        alert(erro.message);
        return;
      }

      console.error(erro);
      alert('Não foi possível atualizar a estação.');
    }
  };

  const alternarSensor = (sensor: Sensor) => {
    setSensoresSelecionados((anteriores) => {
      const existe = anteriores.some(
        (item) => item.id === sensor.id,
      );

      if (existe) {
        return anteriores.filter(
          (item) => item.id !== sensor.id,
        );
      }

      return [...anteriores, sensor];
    });
  };

  const tableColumns: Column<Estacao>[] = [
    {
      key: 'nome',
      header: 'Estação',
      render: (_, estacao) => (
        <div>
          <p className="font-medium">
            {estacao.nome}
          </p>

          <p className="text-xs text-muted-foreground">
            {estacao.codigo}
          </p>
        </div>
      ),
    },

    {
      key: 'endereco',
      header: 'Endereço',
      render: (_, estacao) => (
        <span>{estacao.endereco}</span>
      ),
    },

    {
      key: 'latitude',
      header: 'Localização',
      render: (_, estacao) => (
        <div className="text-sm">
          <p>
            Lat: {estacao.latitude}
          </p>

          <p>
            Long: {estacao.longitude}
          </p>
        </div>
      ),
    },

    {
      key: 'status',
      header: 'Status',
      render: (_, estacao) => (
        <span
          className={
            estacao.status === 'Ativo'
              ? 'inline-flex rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-700'
              : 'inline-flex rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600'
          }
        >
          {estacao.status}
        </span>
      ),
    },

    {
      key: 'sensores',
      header: 'Sensores',
      render: (_, estacao) => (
        <div className="flex flex-wrap gap-1">
          {estacao.sensores.length === 0 ? (
            <span className="text-sm text-muted-foreground">
              Nenhum
            </span>
          ) : (
            estacao.sensores.map((sensor) => (
              <span
                key={sensor.id}
                className="rounded-md bg-muted px-2 py-1 text-xs"
              >
                {sensor.nome}
              </span>
            ))
          )}
        </div>
      ),
    },

    {
      key: 'longitude',
      header: '',
      render: (_, estacao) => (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={(event) =>
              abrirMenu(
                event,
                estacao.codigo,
              )
            }
            className="rounded-md p-2 hover:bg-muted"
            aria-label={`Ações para ${estacao.nome}`}
          >
            <MoreHorizontal className="h-5 w-5" />
          </button>

          {menuAbertoCodigo ===
            estacao.codigo &&
            posicaoMenu &&
            typeof document !== 'undefined' &&
            createPortal(
              <div
                className="fixed z-[100] w-40 rounded-lg border border-border bg-card p-1 shadow-lg"
                style={{
                  top: posicaoMenu.top,
                  left: posicaoMenu.left,
                }}
                role="menu"
              >
                <button
                  type="button"
                  className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                  onClick={() =>
                    abrirModalEdicao(estacao)
                  }
                >
                  Editar
                </button>

                <button
                  type="button"
                  className={`w-full rounded-md px-3 py-2 text-left text-sm ${
                    estacao.status === 'Ativo'
                      ? 'text-red-600 hover:bg-red-50'
                      : 'text-green-700 hover:bg-green-50'
                  }`}
                  onClick={() => {
                    if (estacao.status === 'Ativo') {
                      confirmarExclusao(estacao.codigo);
                      return;
                    }

                    void atualizarStatusEstacao(
                      estacao,
                      'ATIVA',
                    );
                  }}
                >
                  {estacao.status === 'Ativo'
                    ? 'Desativar'
                    : 'Ativar'}
                </button>
              </div>,
              document.body,
            )}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeading
        title="Estações"
        description="Gerencie as estações e seus sensores."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="relative w-full sm:max-w-md">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

          <Input
            value={busca}
            onChange={(event) => {
              setBusca(event.target.value);
              setPaginaAtual(1);
            }}
            placeholder="Buscar estação..."
            className="pl-9"
          />
        </div>

        <Button
          type="button"
          onClick={abrirModalCadastro}
        >
          <Plus className="mr-2 h-4 w-4" />
          Nova estação
        </Button>
      </div>

      <div className="min-h-[300px]">
        {carregando ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border">
            <p className="text-sm text-muted-foreground">
              Carregando estações...
            </p>
          </div>
        ) : estacoesPagina.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border">
            <p className="font-medium">
              Nenhuma estação encontrada
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {busca
                ? 'Tente alterar os termos da busca.'
                : 'Cadastre a primeira estação.'}
            </p>
          </div>
        ) : (
          <DataTable
            columns={tableColumns}
            data={estacoesPagina}
            currentPage={paginaSegura}
            totalPages={totalPaginas}
            onPageChange={(page: number) =>
              setPaginaAtual(page)
            }
            rowKey="codigo"
          />
        )}
      </div>

      {modalCadastroAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Cadastrar estação
                </h2>

                <p className="text-sm text-muted-foreground">
                  Preencha os dados da estação.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalCadastroAberto(false)
                }
                className="rounded-md p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Nome da estação
                </label>

                <Input
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  placeholder="Ex.: Estação Centro"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  UUID/MAC
                </label>

                <Input
                  value={vid}
                  onChange={(event) =>
                    setVid(event.target.value)
                  }
                  placeholder="UUID ou MAC do dispositivo"
                />

                <p className="mt-1 text-xs text-muted-foreground">
                  Este é o identificador do dispositivo.
                  O UUID interno da estação é gerado
                  automaticamente pelo banco.
                </p>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Latitude
                </label>

                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(event) =>
                    setLatitude(event.target.value)
                  }
                  placeholder="-23.1896"
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Longitude
                </label>

                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(event) =>
                    setLongitude(event.target.value)
                  }
                  placeholder="-45.8841"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Endereço / Região
                </label>

                <Input
                  value={endereco}
                  onChange={(event) =>
                    setEndereco(event.target.value)
                  }
                  placeholder="Ex.: Parque Central, São Paulo - SP"
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex items-center justify-between">
                <div>
                  <label className="block text-sm font-medium">
                    Sensores
                  </label>

                  <p className="text-xs text-muted-foreground">
                    Selecione os tipos de parâmetro associados.
                  </p>
                </div>

                <button
                  type="button"
                  onClick={() =>
                    setModalSensoresAberto(true)
                  }
                  className="text-sm font-medium text-primary hover:underline"
                >
                  Selecionar sensores
                </button>
              </div>

              {sensoresSelecionados.length === 0 ? (
                <div className="rounded-lg border border-dashed p-4 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nenhum sensor selecionado.
                  </p>
                </div>
              ) : (
                <div className="flex flex-wrap gap-2">
                  {sensoresSelecionados.map(
                    (sensor) => (
                      <span
                        key={sensor.id}
                        className="rounded-md bg-muted px-3 py-1.5 text-sm"
                      >
                        {sensor.nome} ({sensor.unidade})
                      </span>
                    ),
                  )}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalCadastroAberto(false);
                  limparFormulario();
                }}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={cadastrarEstacao}
              >
                Cadastrar estação
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalSensoresAberto && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-lg rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-5 flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold">
                  Selecionar sensores
                </h2>

                <p className="text-sm text-muted-foreground">
                  Selecione os sensores da estação.
                </p>
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalSensoresAberto(false)
                }
                className="rounded-md p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2">
              {SENSORES_DISPONIVEIS.map(
                (sensor) => {
                  const selecionado =
                    sensoresSelecionados.some(
                      (item) =>
                        item.id === sensor.id,
                    );

                  return (
                    <button
                      key={sensor.id}
                      type="button"
                      onClick={() =>
                        alternarSensor(sensor)
                      }
                      className={`flex w-full items-center justify-between rounded-lg border p-3 text-left transition ${
                        selecionado
                          ? 'border-primary bg-primary/10'
                          : 'hover:bg-muted'
                      }`}
                    >
                      <div>
                        <p className="font-medium">
                          {sensor.nome}
                        </p>

                        <p className="text-xs text-muted-foreground">
                          Unidade: {sensor.unidade}
                        </p>
                      </div>

                      {selecionado && (
                        <span className="text-sm font-medium">
                          Selecionado
                        </span>
                      )}
                    </button>
                  );
                },
              )}
            </div>

            <div className="mt-5 flex justify-end">
              <Button
                type="button"
                onClick={() =>
                  setModalSensoresAberto(false)
                }
              >
                Confirmar
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalEdicaoAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="w-full max-w-2xl rounded-xl bg-card p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <div>
                <h2 className="text-xl font-semibold">
                  Editar estação
                </h2>

                <p className="text-sm text-muted-foreground">
                  Edite os dados da estação.
                </p>
              </div>

              <button
                type="button"
                onClick={() => {
                  setModalEdicaoAberto(false);
                  limparFormulario();
                }}
                className="rounded-md p-2 hover:bg-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Nome
                </label>

                <Input
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  UUID/MAC
                </label>

                <Input
                  value={vid}
                  onChange={(event) =>
                    setVid(event.target.value)
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Latitude
                </label>

                <Input
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(event) =>
                    setLatitude(event.target.value)
                  }
                />
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium">
                  Longitude
                </label>

                <Input
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(event) =>
                    setLongitude(event.target.value)
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <label className="mb-1 block text-sm font-medium">
                  Endereço
                </label>

                <Input
                  value={endereco}
                  onChange={(event) =>
                    setEndereco(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="mt-5">
              <label className="mb-2 block text-sm font-medium">
                Sensores
              </label>

              <div className="flex flex-wrap gap-2">
                {sensoresSelecionados.map(
                  (sensor) => (
                    <span
                      key={sensor.id}
                      className="rounded-md bg-muted px-3 py-1.5 text-sm"
                    >
                      {sensor.nome} ({sensor.unidade})
                    </span>
                  ),
                )}
              </div>

              <button
                type="button"
                onClick={() =>
                  setModalSensoresAberto(true)
                }
                className="mt-2 text-sm font-medium text-primary hover:underline"
              >
                Alterar sensores
              </button>
            </div>

            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalEdicaoAberto(false);
                  limparFormulario();
                }}
              >
                Cancelar
              </Button>

              <Button
                type="button"
                onClick={salvarEdicao}
              >
                Salvar alterações
              </Button>
            </div>
          </div>
        </div>
      )}

      {modalExclusaoAberto &&
        estacaoSelecionada && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
            <div className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl">
              <h2 className="text-lg font-semibold">
                Desativar estação
              </h2>

              <p className="mt-2 text-sm text-muted-foreground">
                Tem certeza que deseja desativar a
                estação{' '}
                <strong>
                  {estacaoSelecionada.nome}
                </strong>
                ?
              </p>

              <div className="mt-6 flex justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => {
                    setModalExclusaoAberto(false);
                    setEstacaoSelecionada(null);
                  }}
                >
                  Cancelar
                </Button>

                <Button
                  type="button"
                  onClick={excluirEstacao}
                  className="bg-red-600 text-white hover:bg-red-700"
                >
                  Desativar
                </Button>
              </div>
            </div>
          </div>
        )}
    </div>
  );
}