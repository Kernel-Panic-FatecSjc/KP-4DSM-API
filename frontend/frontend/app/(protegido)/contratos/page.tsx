'use client';

import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { cnpjValido, formatarCnpj, gerarCnpj, limparCnpj } from '@/lib/cnpj';

const ITENS_POR_PAGINA = 5;

type StatusContrato = 'VIGENTE' | 'ENCERRADO' | 'SUSPENSO';

interface Contrato {
  id: string;
  numero: string;
  orgao: string;
  cnpj: string;
  inicioVigencia: string;
  fimVigencia: string;
  status: StatusContrato;
  estacaoIds: string[];
}

type FormularioContrato = Omit<Contrato, 'id'>;

interface EstacaoMock {
  id: string;
  nome: string;
  codigo: string;
}

const ESTACOES_DISPONIVEIS: EstacaoMock[] = [
  { id: 'estacao-centro-sjc', nome: 'Centro - São José dos Campos', codigo: 'SJC-001' },
  { id: 'estacao-santana-sjc', nome: 'Santana - São José dos Campos', codigo: 'SJC-002' },
  { id: 'estacao-jacarei', nome: 'Centro - Jacareí', codigo: 'JCR-001' },
  { id: 'estacao-taubate', nome: 'Centro - Taubaté', codigo: 'TBT-001' },
  { id: 'estacao-cacapava', nome: 'Centro - Caçapava', codigo: 'CCV-001' },
  { id: 'estacao-paraibuna', nome: 'Centro - Paraibuna', codigo: 'PBN-001' },
];

const CONTRATOS_INICIAIS: Contrato[] = [
  {
    id: 'contrato-1',
    numero: '018/2025',
    orgao: 'Defesa Civil de São José dos Campos',
    cnpj: gerarCnpj('123456780001'),
    inicioVigencia: '2025-02-01',
    fimVigencia: '2027-01-31',
    status: 'VIGENTE',
    estacaoIds: ['estacao-centro-sjc', 'estacao-santana-sjc'],
  },
  {
    id: 'contrato-2',
    numero: '042/2024',
    orgao: 'Prefeitura Municipal de Jacareí',
    cnpj: gerarCnpj('234567890001'),
    inicioVigencia: '2024-06-15',
    fimVigencia: '2026-06-14',
    status: 'VIGENTE',
    estacaoIds: ['estacao-jacarei'],
  },
  {
    id: 'contrato-3',
    numero: '007/2023',
    orgao: 'Coordenadoria Estadual de Proteção e Defesa Civil',
    cnpj: gerarCnpj('345678900001'),
    inicioVigencia: '2023-03-01',
    fimVigencia: '2025-02-28',
    status: 'ENCERRADO',
    estacaoIds: ['estacao-centro-sjc', 'estacao-taubate'],
  },
  {
    id: 'contrato-4',
    numero: '031/2025',
    orgao: 'Defesa Civil de Taubaté',
    cnpj: gerarCnpj('456789010001'),
    inicioVigencia: '2025-08-01',
    fimVigencia: '2026-07-31',
    status: 'SUSPENSO',
    estacaoIds: ['estacao-taubate'],
  },
  {
    id: 'contrato-6',
    numero: '055/2025',
    orgao: 'Defesa Civil de Caçapava',
    cnpj: gerarCnpj('567890120001'),
    inicioVigencia: '2025-09-01',
    fimVigencia: '2027-08-31',
    status: 'VIGENTE',
    estacaoIds: ['estacao-cacapava'],
  },
  {
    id: 'contrato-7',
    numero: '012/2024',
    orgao: 'Prefeitura Municipal de Paraibuna',
    cnpj: gerarCnpj('678901230001'),
    inicioVigencia: '2024-04-01',
    fimVigencia: '2026-03-31',
    status: 'ENCERRADO',
    estacaoIds: ['estacao-paraibuna'],
  },
  {
    id: 'contrato-8',
    numero: '023/2026',
    orgao: 'Defesa Civil de Pindamonhangaba',
    cnpj: gerarCnpj('789012340001'),
    inicioVigencia: '2026-01-15',
    fimVigencia: '2028-01-14',
    status: 'VIGENTE',
    estacaoIds: [],
  },
  {
    id: 'contrato-9',
    numero: '019/2024',
    orgao: 'Prefeitura Municipal de Igaratá',
    cnpj: gerarCnpj('890123450001'),
    inicioVigencia: '2024-11-01',
    fimVigencia: '2026-10-31',
    status: 'SUSPENSO',
    estacaoIds: ['estacao-paraibuna'],
  },
  {
    id: 'contrato-10',
    numero: '004/2023',
    orgao: 'Defesa Civil de Santa Branca',
    cnpj: gerarCnpj('901234560001'),
    inicioVigencia: '2023-05-01',
    fimVigencia: '2025-04-30',
    status: 'ENCERRADO',
    estacaoIds: [],
  },
  {
    id: 'contrato-11',
    numero: '026/2026',
    orgao: 'Prefeitura Municipal de Monteiro Lobato',
    cnpj: gerarCnpj('012345670001'),
    inicioVigencia: '2026-07-01',
    fimVigencia: '2028-06-30',
    status: 'VIGENTE',
    estacaoIds: [],
  },
];

const FORMULARIO_INICIAL: FormularioContrato = {
  numero: '',
  orgao: '',
  cnpj: '',
  inicioVigencia: '',
  fimVigencia: '',
  status: 'VIGENTE',
  estacaoIds: [],
};

const ROTULOS_STATUS: Record<StatusContrato, string> = {
  VIGENTE: 'Vigente',
  ENCERRADO: 'Encerrado',
  SUSPENSO: 'Suspenso',
};

const CORES_STATUS: Record<StatusContrato, string> = {
  VIGENTE: 'bg-lime/10 border-lime/30 text-lime',
  ENCERRADO: 'bg-muted border-border text-muted-foreground',
  SUSPENSO: 'bg-warning/10 border-warning/30 text-warning',
};

function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(`${data}T00:00:00Z`),
  );
}

export default function ContratosPage() {
  const router = useRouter();

  const [contratos, setContratos] = useState<Contrato[]>(CONTRATOS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusContrato | 'TODOS'>('TODOS');
  const [pagina, setPagina] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<Contrato | null>(null);
  const [contratoExcluindo, setContratoExcluindo] = useState<Contrato | null>(null);
  const [dadosParaEncerrar, setDadosParaEncerrar] = useState<FormularioContrato | null>(null);
  const [formulario, setFormulario] = useState<FormularioContrato>(FORMULARIO_INICIAL);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);

  const contratosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const cnpjTermo = limparCnpj(termo);
    return contratos.filter((contrato) => {
      const correspondeBusca =
        !termo ||
        contrato.numero.toLocaleLowerCase('pt-BR').includes(termo) ||
        contrato.orgao.toLocaleLowerCase('pt-BR').includes(termo) ||
        (cnpjTermo !== '' && contrato.cnpj.includes(cnpjTermo));
      const correspondeStatus = filtroStatus === 'TODOS' || contrato.status === filtroStatus;
      return correspondeBusca && correspondeStatus;
    });
  }, [busca, contratos, filtroStatus]);

  const totalPaginas = Math.max(1, Math.ceil(contratosFiltrados.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const contratosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return contratosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [contratosFiltrados, paginaAtual]);

  const estatisticas = useMemo(
    () => ({
      total: contratos.length,
      vigentes: contratos.filter((contrato) => contrato.status === 'VIGENTE').length,
      encerrados: contratos.filter((contrato) => contrato.status === 'ENCERRADO').length,
    }),
    [contratos],
  );

  function abrirCadastro() {
    setContratoEditando(null);
    setFormulario(FORMULARIO_INICIAL);
    setErroFormulario(null);
    setModalAberto(true);
  }

  function abrirEdicao(contrato: Contrato) {
    setContratoEditando(contrato);
    setFormulario({
      numero: contrato.numero,
      orgao: contrato.orgao,
      cnpj: formatarCnpj(contrato.cnpj),
      inicioVigencia: contrato.inicioVigencia,
      fimVigencia: contrato.fimVigencia,
      status: contrato.status,
      estacaoIds: contrato.estacaoIds,
    });
    setErroFormulario(null);
    setModalAberto(true);
  }

  function salvarContrato(evento: React.FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const numero = formulario.numero.trim();
    const orgao = formulario.orgao.trim();
    const cnpj = limparCnpj(formulario.cnpj);

    if (!numero || !orgao || !cnpj || !formulario.inicioVigencia || !formulario.fimVigencia) {
      setErroFormulario('Preencha todos os campos para salvar o contrato.');
      return;
    }

    if (!cnpjValido(cnpj)) {
      setErroFormulario('Informe um CNPJ válido, incluindo os dígitos verificadores.');
      return;
    }

    if (formulario.fimVigencia < formulario.inicioVigencia) {
      setErroFormulario('O fim da vigência deve ser posterior ao início.');
      return;
    }

    const numeroDuplicado = contratos.some(
      (contrato) =>
        contrato.numero.toLocaleLowerCase('pt-BR') === numero.toLocaleLowerCase('pt-BR') &&
        contrato.id !== contratoEditando?.id,
    );
    if (numeroDuplicado) {
      setErroFormulario('Já existe um contrato cadastrado com esse número.');
      return;
    }

    const cnpjDuplicado = contratos.some(
      (contrato) => contrato.cnpj === cnpj && contrato.id !== contratoEditando?.id,
    );
    if (cnpjDuplicado) {
      setErroFormulario('Já existe um contrato cadastrado com esse CNPJ.');
      return;
    }

    const dados = { ...formulario, numero, orgao, cnpj };
    if (dados.status === 'ENCERRADO' && contratoEditando?.status !== 'ENCERRADO') {
      setDadosParaEncerrar(dados);
      return;
    }
    aplicarContrato(dados);
  }

  function aplicarContrato(dados: FormularioContrato) {
    if (contratoEditando) {
      setContratos((atuais) =>
        atuais.map((contrato) =>
          contrato.id === contratoEditando.id ? { ...contrato, ...dados } : contrato,
        ),
      );
    } else {
      setContratos((atuais) => [
        { id: `contrato-${Date.now()}`, ...dados },
        ...atuais,
      ]);
      setPagina(1);
    }

    setModalAberto(false);
    setContratoEditando(null);
    setDadosParaEncerrar(null);
    setErroFormulario(null);
  }

  function confirmarEncerramento() {
    if (!dadosParaEncerrar) return;
    aplicarContrato(dadosParaEncerrar);
  }

  function excluirContrato() {
    if (!contratoExcluindo) return;
    setContratos((atuais) =>
      atuais.filter((contrato) => contrato.id !== contratoExcluindo.id),
    );
    setContratoExcluindo(null);
  }

  const colunas: Column<Contrato>[] = [
    {
      header: 'Número do contrato',
      key: 'numero',
      render: (_, contrato) => (
        <div>
          <p className="font-medium">{contrato.numero}</p>
          <p className="font-mono text-xs text-muted-foreground">{contrato.id}</p>
        </div>
      ),
    },
    { header: 'Órgão público', key: 'orgao' },
    {
      header: 'CNPJ',
      key: 'cnpj',
      render: (cnpj) => (
        <span className="whitespace-nowrap font-mono text-xs">{formatarCnpj(String(cnpj))}</span>
      ),
    },
    {
      header: 'Estações vinculadas',
      key: 'estacaoIds',
      render: (_, contrato) => {
        const estacoes = ESTACOES_DISPONIVEIS.filter((estacao) =>
          contrato.estacaoIds.includes(estacao.id),
        );
        return estacoes.length > 0 ? (
          <div className="flex min-w-44 flex-col gap-1">
            {estacoes.map((estacao) => (
              <span key={estacao.id} className="text-xs">
                {estacao.nome}
                <span className="ml-1 font-mono text-[10px] text-muted-foreground">
                  ({estacao.codigo})
                </span>
              </span>
            ))}
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">Nenhuma estação vinculada</span>
        );
      },
    },
    {
      header: 'Vigência',
      key: 'inicioVigencia',
      render: (_, contrato) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {formatarData(contrato.inicioVigencia)} – {formatarData(contrato.fimVigencia)}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (_, contrato) => (
        <span
          className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${CORES_STATUS[contrato.status]}`}
        >
          {ROTULOS_STATUS[contrato.status]}
        </span>
      ),
    },
    {
      header: 'Ações',
      key: 'id',
      render: (_, contrato) => (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => router.push(`/contratos/${contrato.id}`)}
            className="inline-flex items-center gap-1 text-xs font-medium text-aqua hover:underline"
          >
            Detalhes
          </button>

          <button
            type="button"
            onClick={() => abrirEdicao(contrato)}
            className="inline-flex items-center gap-1 text-xs font-medium text-aqua hover:underline"
          >
            <Pencil className="size-3" />
            Editar
          </button>

          <button
            type="button"
            onClick={() => setContratoExcluindo(contrato)}
            className="inline-flex items-center gap-1 text-xs font-medium text-destructive hover:underline"
          >
            <Trash2 className="size-3" />
            Excluir
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Contratos e licitações"
        description="Acompanhe os contratos públicos, seus órgãos e períodos de vigência."
        action={
          <Button type="button" onClick={abrirCadastro}>
            <Plus />
            Novo contrato
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo de contratos">
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Total de contratos</p>
          <p className="mt-2 font-display text-2xl font-semibold">{estatisticas.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">cadastrados neste navegador</p>
        </article>
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Vigentes</p>
          <p className="mt-2 font-display text-2xl font-semibold">{estatisticas.vigentes}</p>
          <p className="mt-1 text-xs text-muted-foreground">contratos em andamento</p>
        </article>
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Encerrados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{estatisticas.encerrados}</p>
          <p className="mt-1 text-xs text-muted-foreground">contratos finalizados</p>
        </article>
      </section>

      <section aria-label="Filtros de contratos" className="grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="buscaContrato"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Buscar
          </label>
          <Input
            id="buscaContrato"
            type="search"
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por número ou órgão público..."
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="statusContrato"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Status
          </label>
          <Select
            id="statusContrato"
            value={filtroStatus}
            onChange={(evento) => {
              setFiltroStatus(evento.target.value as StatusContrato | 'TODOS');
              setPagina(1);
            }}
          >
            <option value="TODOS">Todos os status</option>
            <option value="VIGENTE">Vigente</option>
            <option value="ENCERRADO">Encerrado</option>
            <option value="SUSPENSO">Suspenso</option>
          </Select>
        </div>
      </section>

      <DataTable<Contrato>
        columns={colunas}
        data={contratosPaginados}
        currentPage={paginaAtual}
        totalPages={totalPaginas}
        onPageChange={setPagina}
        rowKey="id"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={salvarContrato}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-contrato"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="titulo-modal-contrato" className="text-xl font-semibold">
                  {contratoEditando ? 'Editar contrato' : 'Cadastrar contrato'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Preencha os dados de demonstração do contrato público.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setModalAberto(false);
                  setDadosParaEncerrar(null);
                  setErroFormulario(null);
                }}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Fechar modal"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="numeroContrato" className="text-sm font-medium">
                    Número do contrato
                  </label>
                  <Input
                    id="numeroContrato"
                    required
                    maxLength={40}
                    autoFocus
                    placeholder="Ex.: 018/2025"
                    value={formulario.numero}
                    onChange={(evento) =>
                      setFormulario((atual) => ({ ...atual, numero: evento.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="statusModalContrato" className="text-sm font-medium">
                    Status
                  </label>
                  <Select
                    id="statusModalContrato"
                    value={formulario.status}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        status: evento.target.value as StatusContrato,
                      }))
                    }
                  >
                    <option value="VIGENTE">Vigente</option>
                    <option value="ENCERRADO">Encerrado</option>
                    <option value="SUSPENSO">Suspenso</option>
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="orgaoContrato" className="text-sm font-medium">
                  Órgão público
                </label>
                <Input
                  id="orgaoContrato"
                  required
                  maxLength={160}
                  placeholder="Ex.: Defesa Civil municipal"
                  value={formulario.orgao}
                  onChange={(evento) =>
                    setFormulario((atual) => ({ ...atual, orgao: evento.target.value }))
                  }
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="cnpjContrato" className="text-sm font-medium">
                  CNPJ
                </label>
                <Input
                  id="cnpjContrato"
                  required
                  autoCapitalize="characters"
                  autoComplete="off"
                  maxLength={18}
                  placeholder="00.000.000/0000-00"
                  value={formulario.cnpj}
                  aria-describedby="ajudaCnpjContrato"
                  onChange={(evento) =>
                    setFormulario((atual) => ({
                      ...atual,
                      cnpj: formatarCnpj(evento.target.value),
                    }))
                  }
                />
                <p id="ajudaCnpjContrato" className="text-xs text-muted-foreground">
                  O CNPJ será validado pelos dígitos verificadores antes de salvar.
                </p>
              </div>

              <fieldset className="rounded-md border border-border p-3">
                <legend className="px-1 text-sm font-medium">Estações vinculadas</legend>
                <p className="mb-3 text-xs text-muted-foreground">
                  Selecione as estações atendidas por este contrato.
                </p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {ESTACOES_DISPONIVEIS.map((estacao) => {
                    const selecionada = formulario.estacaoIds.includes(estacao.id);
                    return (
                      <label
                        key={estacao.id}
                        className="flex cursor-pointer items-start gap-2 rounded-md border border-border p-2.5 text-sm hover:bg-muted/40"
                      >
                        <input
                          type="checkbox"
                          checked={selecionada}
                          onChange={() =>
                            setFormulario((atual) => ({
                              ...atual,
                              estacaoIds: selecionada
                                ? atual.estacaoIds.filter((id) => id !== estacao.id)
                                : [...atual.estacaoIds, estacao.id],
                            }))
                          }
                          className="mt-0.5 accent-current"
                        />
                        <span>
                          <span className="block font-medium">{estacao.nome}</span>
                          <span className="font-mono text-xs text-muted-foreground">
                            {estacao.codigo}
                          </span>
                        </span>
                      </label>
                    );
                  })}
                </div>
              </fieldset>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="inicioVigencia" className="text-sm font-medium">
                    Início da vigência
                  </label>
                  <Input
                    id="inicioVigencia"
                    type="date"
                    required
                    value={formulario.inicioVigencia}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        inicioVigencia: evento.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="fimVigencia" className="text-sm font-medium">
                    Fim da vigência
                  </label>
                  <Input
                    id="fimVigencia"
                    type="date"
                    required
                    min={formulario.inicioVigencia || undefined}
                    value={formulario.fimVigencia}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        fimVigencia: evento.target.value,
                      }))
                    }
                  />
                </div>
              </div>

              {erroFormulario && (
                <div
                  role="alert"
                  className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
                >
                  {erroFormulario}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setModalAberto(false);
                  setDadosParaEncerrar(null);
                  setErroFormulario(null);
                }}
              >
                Cancelar
              </Button>
              <Button type="submit">
                {contratoEditando ? 'Salvar alterações' : 'Cadastrar contrato'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {contratoExcluindo && (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/50 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-exclusao-contrato"
          >
            <h2 id="titulo-exclusao-contrato" className="text-lg font-semibold">
              Excluir contrato
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Tem certeza que deseja excluir o contrato{' '}
              <strong>{contratoExcluindo.numero}</strong>? Esta ação não pode ser desfeita.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setContratoExcluindo(null)}
              >
                Cancelar
              </Button>
              <Button
                type="button"
                onClick={excluirContrato}
                className="bg-red-600 text-white hover:bg-red-700"
              >
                Excluir
              </Button>
            </div>
          </div>
        </div>
      )}

      {dadosParaEncerrar && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacao-encerramento"
          >
            <h2 id="titulo-confirmacao-encerramento" className="text-lg font-semibold">
              Confirmar encerramento do contrato?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              O contrato <strong>{dadosParaEncerrar.numero}</strong> será marcado como encerrado.
              Deseja continuar?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDadosParaEncerrar(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={confirmarEncerramento}
                className="bg-warning text-warning-foreground hover:opacity-90"
              >
                Encerrar contrato
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
