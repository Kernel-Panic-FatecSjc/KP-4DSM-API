'use client';

import { createPortal } from 'react-dom';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, MoreHorizontal, Plus, Search, X } from 'lucide-react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  api,
  ErroApi,
  type AtualizarEstacaoPayload,
  type CriarEstacaoPayload,
  type EstacaoApi,
  type EstacaoCriadaApi,
  type Paginado,
  type SensorApi,
} from '@/lib/api';
import { ehTecsus, podeCadastrar } from '@/lib/perfil';
import { PageHeading } from '@/components/PageHeading';
import { DataTable, type Column } from '@/components/DataTable';
import { useUsuario } from '@/components/ProtectedLayout';
import { SeletorLicitacao } from '@/components/SeletorLicitacao';
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
  possuiChaveIngestao: boolean;
  sensores: Sensor[];
  licitacao: { id: string; codigoIdentificador: string };
};

// Chave de ingestão recém-gerada: aparece uma única vez, para gravar no datalogger.
type ChaveExibida = {
  estacao: string;
  chave: string;
};

const ITEMS_PER_PAGE = 10;
// Espera o usuário parar de digitar antes de consultar a API.
const ATRASO_BUSCA_MS = 300;
// Maior página que a API aceita: cobre os sensores de uma licitação.
const TAMANHO_LISTA_SENSORES = 200;

function converterSensor(sensor: { id: string; nome: string; unidade: string }): Sensor {
  return {
    id: sensor.id,
    nome: sensor.nome,
    tipo: sensor.nome,
    unidade: sensor.unidade,
  };
}

function converterEstacao(estacao: EstacaoApi): Estacao {
  return {
    id: estacao.id,
    nome: estacao.nome,
    codigo: estacao.vid,
    possuiChaveIngestao: estacao.possuiChaveIngestao,
    latitude: estacao.latitude,
    longitude: estacao.longitude,
    status: estacao.statusOperacional === 'ATIVA' ? 'Ativo' : 'Não Ativo',
    endereco: estacao.endereco,
    sensores: estacao.sensores.map(converterSensor),
    licitacao: estacao.licitacao,
  };
}

export default function EstacoesPage() {
  const router = useRouter();
  const usuario = useUsuario();
  const tecsus = ehTecsus(usuario);
  // Cadastro, edição e chave de ingestão: Tecsus e admin da licitação, fora de licitação encerrada.
  const podeEditar = podeCadastrar(usuario);

  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const ultimaConsulta = useRef(0);

  const [sensoresDisponiveis, setSensoresDisponiveis] = useState<Sensor[]>([]);
  const [carregandoSensores, setCarregandoSensores] = useState(false);
  const [erroSensores, setErroSensores] = useState<string | null>(null);
  const ultimaConsultaSensores = useRef(0);

  const [busca, setBusca] = useState('');
  const [buscaAplicada, setBuscaAplicada] = useState('');
  const [licitacaoFiltro, setLicitacaoFiltro] = useState('');
  const [paginaAtual, setPaginaAtual] = useState(1);
  // Incrementado depois de cadastrar, para reconsultar a listagem.
  const [recarga, setRecarga] = useState(0);

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

  const [licitacaoCadastro, setLicitacaoCadastro] = useState('');
  const [nome, setNome] = useState('');
  const [vid, setVid] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [endereco, setEndereco] = useState('');

  const [sensoresSelecionados, setSensoresSelecionados] =
    useState<Sensor[]>([]);

  const [chaveExibida, setChaveExibida] =
    useState<ChaveExibida | null>(null);
  const [chaveCopiada, setChaveCopiada] = useState(false);

  /** 401 manda para o login; o resto vira alerta. */
  const tratarErro = useCallback(
    (erro: unknown, padrao: string) => {
      if (erro instanceof ErroApi) {
        if (erro.status === 401) {
          router.push('/login?proximo=/estacoes');
          return;
        }

        alert(erro.message);
        return;
      }

      console.error(erro);
      alert(padrao);
    },
    [router],
  );

  const carregarEstacoes = useCallback(async () => {
    const consulta = ++ultimaConsulta.current;
    setCarregando(true);

    const parametros = new URLSearchParams({
      pagina: String(paginaAtual),
      tamanho: String(ITEMS_PER_PAGE),
    });
    if (buscaAplicada) parametros.set('busca', buscaAplicada);
    if (licitacaoFiltro) parametros.set('licitacaoId', licitacaoFiltro);

    try {
      const resposta = await api<Paginado<EstacaoApi>>(`/estacoes?${parametros}`);
      // Uma consulta mais nova (ex.: busca digitada) já está a caminho.
      if (consulta !== ultimaConsulta.current) return;
      setEstacoes(resposta.itens.map(converterEstacao));
      setTotal(resposta.total);
    } catch (erro) {
      if (consulta !== ultimaConsulta.current) return;
      tratarErro(erro, 'Não foi possível carregar as estações.');
    } finally {
      if (consulta === ultimaConsulta.current) setCarregando(false);
    }
  }, [tratarErro, paginaAtual, buscaAplicada, licitacaoFiltro]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- busca a listagem ao montar a página e ao mudar o filtro
    void carregarEstacoes();
    // recarga não é lida aqui: só refaz a consulta depois de cadastrar.
  }, [carregarEstacoes, recarga]);

  useEffect(() => {
    const espera = setTimeout(() => {
      setBuscaAplicada(busca.trim());
      setPaginaAtual(1);
    }, ATRASO_BUSCA_MS);
    return () => clearTimeout(espera);
  }, [busca]);

  // Os sensores de uma estação são da licitação dela. A Tecsus diz qual; o
  // admin da licitação recebe os da própria sem informar.
  const carregarSensores = async (licitacaoId: string) => {
    const consulta = ++ultimaConsultaSensores.current;
    setErroSensores(null);

    if (tecsus && !licitacaoId) {
      setSensoresDisponiveis([]);
      setCarregandoSensores(false);
      return;
    }

    setCarregandoSensores(true);
    const parametros = new URLSearchParams({ tamanho: String(TAMANHO_LISTA_SENSORES) });
    if (tecsus) parametros.set('licitacaoId', licitacaoId);

    try {
      const resposta = await api<Paginado<SensorApi>>(`/sensores?${parametros}`);
      if (consulta !== ultimaConsultaSensores.current) return;
      setSensoresDisponiveis(resposta.itens.map(converterSensor));
    } catch (erro) {
      if (consulta !== ultimaConsultaSensores.current) return;
      if (erro instanceof ErroApi && erro.status === 401) {
        router.push('/login?proximo=/estacoes');
        return;
      }
      setSensoresDisponiveis([]);
      setErroSensores(erro instanceof ErroApi ? erro.message : 'Não foi possível carregar os tipos de sensores.');
    } finally {
      if (consulta === ultimaConsultaSensores.current) setCarregandoSensores(false);
    }
  };

  const totalPaginas = Math.max(1, Math.ceil(total / ITEMS_PER_PAGE));

  const limparFormulario = () => {
    setLicitacaoCadastro('');
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
    // Quem já filtrou uma licitação provavelmente vai cadastrar nela.
    const licitacao = tecsus ? licitacaoFiltro : '';
    setLicitacaoCadastro(licitacao);
    void carregarSensores(licitacao);
    setModalCadastroAberto(true);
  };

  const alterarLicitacaoCadastro = (licitacaoId: string) => {
    setLicitacaoCadastro(licitacaoId);
    // Sensores de outra licitação seriam recusados pela API.
    setSensoresSelecionados([]);
    void carregarSensores(licitacaoId);
  };

  const cadastrarEstacao = async () => {
    try {
      if (tecsus && !licitacaoCadastro) {
        alert('Selecione a licitação da estação.');
        return;
      }

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
        // O admin da licitação omite: o backend usa a licitação dele.
        ...(tecsus ? { licitacaoId: licitacaoCadastro } : {}),
      };

      const novaEstacaoApi =
        await api<EstacaoCriadaApi>('/estacoes', {
          method: 'POST',
          body: JSON.stringify(payload),
        });

      setModalCadastroAberto(false);
      limparFormulario();
      setPaginaAtual(1);
      setRecarga((atual) => atual + 1);

      exibirChave(novaEstacaoApi.nome, novaEstacaoApi.chaveIngestao);
    } catch (erro) {
      tratarErro(erro, 'Não foi possível cadastrar a estação.');
    }
  };

  const exibirChave = (estacao: string, chave: string) => {
    setChaveCopiada(false);
    setChaveExibida({ estacao, chave });
  };

  const copiarChave = async () => {
    if (!chaveExibida) return;

    try {
      await navigator.clipboard.writeText(chaveExibida.chave);
      setChaveCopiada(true);
    } catch {
      alert('Não foi possível copiar. Selecione a chave e copie manualmente.');
    }
  };

  const regenerarChave = async (estacao: Estacao) => {
    setMenuAbertoCodigo(null);

    if (
      estacao.possuiChaveIngestao &&
      !confirm(
        `Gerar uma nova chave para ${estacao.nome}? A chave atual para de funcionar na hora e o datalogger precisa ser atualizado.`,
      )
    ) {
      return;
    }

    try {
      const { chaveIngestao } = await api<{ chaveIngestao: string }>(
        `/estacoes/${estacao.id}/chave-ingestao`,
        { method: 'POST' },
      );

      setEstacoes((anteriores) =>
        anteriores.map((item) =>
          item.id === estacao.id
            ? { ...item, possuiChaveIngestao: true }
            : item,
        ),
      );
      exibirChave(estacao.nome, chaveIngestao);
    } catch (erro) {
      tratarErro(erro, 'Não foi possível gerar a chave de ingestão.');
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
    void carregarSensores(estacao.licitacao.id);

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
      tratarErro(
        erro,
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

    const vidAlterado = vid.trim() !== estacaoSelecionada.codigo;

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

      const estacaoConvertida = converterEstacao(estacaoAtualizada);

      setEstacoes((anteriores) =>
        anteriores.map((estacao) =>
          estacao.id === estacaoAtualizada.id
            ? estacaoConvertida
            : estacao,
        ),
      );

      setModalEdicaoAberto(false);
      limparFormulario();
      alert(
        vidAlterado
          ? 'Estação atualizada. Como o UUID/MAC mudou, a chave de ingestão foi apagada: use "Gerar chave" no menu da estação e grave a nova chave no datalogger.'
          : 'Estação atualizada com sucesso!',
      );
    } catch (erro) {
      tratarErro(erro, 'Não foi possível atualizar a estação.');
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

  const colunaLicitacao: Column<Estacao> = {
    key: 'licitacao',
    header: 'Licitação',
    render: (_, estacao) => (
      <span className="whitespace-nowrap rounded-md bg-muted px-2 py-1 font-mono text-xs">
        {estacao.licitacao.codigoIdentificador}
      </span>
    ),
  };

  const colunaAcoes: Column<Estacao> = {
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
                role="menuitem"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() =>
                  abrirModalEdicao(estacao)
                }
              >
                Editar
              </button>

              <button
                type="button"
                role="menuitem"
                className="w-full rounded-md px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => void regenerarChave(estacao)}
              >
                {estacao.possuiChaveIngestao
                  ? 'Regenerar chave'
                  : 'Gerar chave'}
              </button>

              <button
                type="button"
                role="menuitem"
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
  };

  const tableColumns: Column<Estacao>[] = [
    {
      key: 'nome',
      header: 'Estação',
      render: (_, estacao) => (
        <div className="min-w-40">
          <p className="font-medium">
            {estacao.nome}
          </p>

          <p className="break-all text-xs text-muted-foreground">
            {estacao.codigo}
          </p>
        </div>
      ),
    },

    ...(tecsus ? [colunaLicitacao] : []),

    {
      key: 'endereco',
      header: 'Endereço',
      render: (_, estacao) => (
        <span className="block min-w-40">{estacao.endereco}</span>
      ),
    },

    {
      key: 'latitude',
      header: 'Localização',
      render: (_, estacao) => (
        <div className="whitespace-nowrap text-sm">
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
        <div className="space-y-1">
          <span
            className={
              estacao.status === 'Ativo'
                ? 'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium bg-green-100 text-green-700'
                : 'inline-flex whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium bg-gray-100 text-gray-600'
            }
          >
            {estacao.status}
          </span>

          {/* Sem chave a estação não consegue publicar (ex.: logo depois de trocar o vid). */}
          {!estacao.possuiChaveIngestao && (
            <p className="whitespace-nowrap text-xs text-muted-foreground">
              Sem chave de ingestão
            </p>
          )}
        </div>
      ),
    },

    {
      key: 'sensores',
      header: 'Sensores',
      render: (_, estacao) => (
        <div className="flex min-w-32 flex-wrap gap-1">
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

    ...(podeEditar ? [colunaAcoes] : []),
  ];

  const filtrando = Boolean(buscaAplicada || licitacaoFiltro);

  // Lista de sensores do modal de seleção; a Tecsus precisa escolher a licitação antes.
  const listaSensores = tecsus && modalCadastroAberto && !licitacaoCadastro ? (
    <p className="py-4 text-center text-sm text-muted-foreground">
      Escolha a licitação da estação para ver os sensores dela.
    </p>
  ) : carregandoSensores ? (
    <p className="py-4 text-center text-sm text-muted-foreground">Carregando sensores cadastrados...</p>
  ) : erroSensores ? (
    <p role="alert" className="py-4 text-center text-sm text-destructive">{erroSensores}</p>
  ) : sensoresDisponiveis.length === 0 ? (
    <p className="py-4 text-center text-sm text-muted-foreground">
      Nenhum tipo de sensor cadastrado nesta licitação.{' '}
      <Link href="/sensores" className="font-medium text-primary hover:underline">Cadastrar sensores</Link>
    </p>
  ) : (
    sensoresDisponiveis.map((sensor) => {
      const selecionado =
        sensoresSelecionados.some(
          (item) =>
            item.id === sensor.id,
        );

      return (
        <button
          key={sensor.id}
          type="button"
          aria-pressed={selecionado}
          onClick={() =>
            alternarSensor(sensor)
          }
          className={`flex w-full items-center justify-between gap-3 rounded-lg border p-3 text-left transition ${
            selecionado
              ? 'border-primary bg-primary/10'
              : 'hover:bg-muted'
          }`}
        >
          <div className="min-w-0">
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
    })
  );

  return (
    <div className="space-y-6">
      <PageHeading
        title="Estações"
        description="Gerencie as estações e seus sensores."
      />

      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
        <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-1 sm:flex-row">
          <div className="relative w-full sm:max-w-md">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />

            <Input
              value={busca}
              onChange={(event) => setBusca(event.target.value)}
              placeholder="Buscar por nome ou UUID/MAC..."
              aria-label="Buscar estação"
              className="pl-9"
            />
          </div>

          <SeletorLicitacao
            valor={licitacaoFiltro}
            onChange={(licitacaoId) => {
              setLicitacaoFiltro(licitacaoId);
              setPaginaAtual(1);
            }}
            rotuloTodas="Todas as licitações"
            className="sm:max-w-xs"
          />
        </div>

        {podeEditar && (
          <Button
            type="button"
            onClick={abrirModalCadastro}
            className="w-full sm:w-auto"
          >
            <Plus className="mr-2 h-4 w-4" />
            Nova estação
          </Button>
        )}
      </div>

      <div className="min-h-[300px]">
        {carregando && estacoes.length === 0 ? (
          <div className="flex min-h-[300px] items-center justify-center rounded-lg border">
            <p className="text-sm text-muted-foreground">
              Carregando estações...
            </p>
          </div>
        ) : estacoes.length === 0 ? (
          <div className="flex min-h-[300px] flex-col items-center justify-center rounded-lg border px-4 text-center">
            <p className="font-medium">
              Nenhuma estação encontrada
            </p>

            <p className="mt-1 text-sm text-muted-foreground">
              {filtrando
                ? 'Tente alterar a busca ou o filtro.'
                : podeEditar
                  ? 'Cadastre a primeira estação.'
                  : 'Ainda não há estações cadastradas.'}
            </p>
          </div>
        ) : (
          <DataTable
            columns={tableColumns}
            data={estacoes}
            currentPage={paginaAtual}
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
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-4 shadow-xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-cadastro-estacao"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="titulo-cadastro-estacao" className="text-xl font-semibold">
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
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              {tecsus && (
                <div className="sm:col-span-2">
                  <label htmlFor="estacao-licitacao" className="mb-1 block text-sm font-medium">
                    Licitação
                  </label>

                  <SeletorLicitacao
                    id="estacao-licitacao"
                    valor={licitacaoCadastro}
                    onChange={alterarLicitacaoCadastro}
                  />

                  <p className="mt-1 text-xs text-muted-foreground">
                    A estação pertence a esta licitação e só pode usar os sensores dela.
                  </p>
                </div>
              )}

              <div className="sm:col-span-2">
                <label htmlFor="estacao-nome" className="mb-1 block text-sm font-medium">
                  Nome da estação
                </label>

                <Input
                  id="estacao-nome"
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                  placeholder="Ex.: Estação Centro"
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="estacao-vid" className="mb-1 block text-sm font-medium">
                  UUID/MAC
                </label>

                <Input
                  id="estacao-vid"
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
                <label htmlFor="estacao-latitude" className="mb-1 block text-sm font-medium">
                  Latitude
                </label>

                <Input
                  id="estacao-latitude"
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
                <label htmlFor="estacao-longitude" className="mb-1 block text-sm font-medium">
                  Longitude
                </label>

                <Input
                  id="estacao-longitude"
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
                <label htmlFor="estacao-endereco" className="mb-1 block text-sm font-medium">
                  Endereço / Região
                </label>

                <Input
                  id="estacao-endereco"
                  value={endereco}
                  onChange={(event) =>
                    setEndereco(event.target.value)
                  }
                  placeholder="Ex.: Parque Central, São Paulo - SP"
                />
              </div>
            </div>

            <div className="mt-5">
              <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
                <div>
                  <p className="block text-sm font-medium">
                    Sensores
                  </p>

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

            <div className="mt-6 flex flex-wrap justify-end gap-3">
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
          <div
            className="flex max-h-[calc(100dvh-2rem)] w-full max-w-lg flex-col rounded-xl bg-card p-4 shadow-xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-selecao-sensores"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="titulo-selecao-sensores" className="text-lg font-semibold">
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
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="min-h-0 space-y-2 overflow-y-auto">
              {listaSensores}
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

      {modalEdicaoAberto && estacaoSelecionada && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div
            className="max-h-[calc(100dvh-2rem)] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-4 shadow-xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-edicao-estacao"
          >
            <div className="mb-6 flex items-start justify-between gap-4">
              <div>
                <h2 id="titulo-edicao-estacao" className="text-xl font-semibold">
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
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {tecsus && (
              <p className="mb-4 text-sm text-muted-foreground">
                Licitação:{' '}
                <span className="font-mono text-foreground">
                  {estacaoSelecionada.licitacao.codigoIdentificador}
                </span>
                . Para transferir a estação, use a tela de licitações.
              </p>
            )}

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="sm:col-span-2">
                <label htmlFor="edicao-nome" className="mb-1 block text-sm font-medium">
                  Nome
                </label>

                <Input
                  id="edicao-nome"
                  value={nome}
                  onChange={(event) =>
                    setNome(event.target.value)
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="edicao-vid" className="mb-1 block text-sm font-medium">
                  UUID/MAC
                </label>

                <Input
                  id="edicao-vid"
                  value={vid}
                  onChange={(event) =>
                    setVid(event.target.value)
                  }
                />

                {vid.trim() !== estacaoSelecionada.codigo && (
                  <p role="status" className="mt-2 rounded-md border border-warning/40 bg-warning/10 px-3 py-2 text-xs text-foreground">
                    Ao trocar o UUID/MAC, a chave de ingestão da estação é apagada. Depois de salvar, use
                    &quot;Gerar chave&quot; no menu da estação e grave a nova chave no datalogger.
                  </p>
                )}
              </div>

              <div>
                <label htmlFor="edicao-latitude" className="mb-1 block text-sm font-medium">
                  Latitude
                </label>

                <Input
                  id="edicao-latitude"
                  type="number"
                  step="any"
                  value={latitude}
                  onChange={(event) =>
                    setLatitude(event.target.value)
                  }
                />
              </div>

              <div>
                <label htmlFor="edicao-longitude" className="mb-1 block text-sm font-medium">
                  Longitude
                </label>

                <Input
                  id="edicao-longitude"
                  type="number"
                  step="any"
                  value={longitude}
                  onChange={(event) =>
                    setLongitude(event.target.value)
                  }
                />
              </div>

              <div className="sm:col-span-2">
                <label htmlFor="edicao-endereco" className="mb-1 block text-sm font-medium">
                  Endereço
                </label>

                <Input
                  id="edicao-endereco"
                  value={endereco}
                  onChange={(event) =>
                    setEndereco(event.target.value)
                  }
                />
              </div>
            </div>

            <div className="mt-5">
              <p className="mb-2 block text-sm font-medium">
                Sensores
              </p>

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

            <div className="mt-6 flex flex-wrap justify-end gap-3">
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
            <div className="w-full max-w-md rounded-xl bg-card p-4 shadow-xl sm:p-6" role="alertdialog" aria-modal="true">
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

              <div className="mt-6 flex flex-wrap justify-end gap-3">
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

      {chaveExibida && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-card p-4 shadow-xl sm:p-6"
            role="dialog"
            aria-labelledby="titulo-chave-ingestao"
          >
            <h2
              id="titulo-chave-ingestao"
              className="text-lg font-semibold"
            >
              Chave de ingestão
            </h2>

            <p className="mt-2 text-sm text-muted-foreground">
              Grave esta chave no datalogger da estação{' '}
              <strong>{chaveExibida.estacao}</strong>. Ela
              não será mostrada de novo; se perder, gere
              outra.
            </p>

            <div className="mt-4 flex items-center gap-2">
              <code className="min-w-0 flex-1 break-all rounded-md bg-muted px-3 py-2 text-sm">
                {chaveExibida.chave}
              </code>

              <Button
                type="button"
                variant="outline"
                onClick={() => void copiarChave()}
                aria-label="Copiar chave"
              >
                <Copy className="h-4 w-4" />
              </Button>
            </div>

            {chaveCopiada && (
              <p className="mt-2 text-xs text-muted-foreground">
                Chave copiada.
              </p>
            )}

            <div className="mt-6 flex justify-end">
              <Button
                type="button"
                onClick={() => setChaveExibida(null)}
              >
                Já guardei a chave
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
