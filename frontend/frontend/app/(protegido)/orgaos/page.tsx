'use client';

import { Pencil, Plus, Trash2, X } from 'lucide-react';
import { useMemo, useState, type FormEvent } from 'react';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';

const ITENS_POR_PAGINA = 5;

type Status = 'ATIVO' | 'DESATIVADO';
type FiltroStatus = Status | 'TODOS';

interface Orgao {
  id: string;
  nome: string;
  cnpj: string;
  status: Status;
}

type FormularioOrgao = Omit<Orgao, 'id'>;

function calcularDigitoCnpj(digitos: string): string {
  const pesos = digitos.length === 12
    ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  const soma = [...digitos].reduce(
    (total, digito, indice) => total + Number(digito) * pesos[indice],
    0,
  );
  const resto = soma % 11;
  return String(resto < 2 ? 0 : 11 - resto);
}

function gerarCnpj(base: string): string {
  const primeiro = calcularDigitoCnpj(base);
  const segundo = calcularDigitoCnpj(`${base}${primeiro}`);
  return `${base}${primeiro}${segundo}`;
}

function formatarCnpj(valor: string): string {
  const digitos = valor.replace(/\D/g, '').slice(0, 14);
  return digitos
    .replace(/^(\d{2})(\d)/, '$1.$2')
    .replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2')
    .replace(/(\d{4})(\d)/, '$1-$2');
}

function cnpjValido(valor: string): boolean {
  const digitos = valor.replace(/\D/g, '');
  if (digitos.length !== 14 || /^(\d)\1{13}$/.test(digitos)) return false;
  const base = digitos.slice(0, 12);
  const primeiro = calcularDigitoCnpj(base);
  const segundo = calcularDigitoCnpj(`${base}${primeiro}`);
  return digitos === `${base}${primeiro}${segundo}`;
}

const ORGAOS_INICIAIS: Orgao[] = [
  {
    id: 'orgao-1',
    nome: 'Defesa Civil de São José dos Campos',
    cnpj: gerarCnpj('123456780001'),
    status: 'ATIVO',
  },
  {
    id: 'orgao-2',
    nome: 'Prefeitura Municipal de Jacareí',
    cnpj: gerarCnpj('234567890001'),
    status: 'ATIVO',
  },
  {
    id: 'orgao-3',
    nome: 'Coordenadoria Estadual de Proteção e Defesa Civil',
    cnpj: gerarCnpj('345678900001'),
    status: 'DESATIVADO',
  },
  {
    id: 'orgao-4',
    nome: 'Defesa Civil de Taubaté',
    cnpj: gerarCnpj('456789010001'),
    status: 'DESATIVADO',
  },
];

const FORMULARIO_INICIAL: FormularioOrgao = {
  nome: '',
  cnpj: '',
  status: 'ATIVO',
};

const ROTULOS_STATUS: Record<Status, string> = {
  ATIVO: 'Ativo',
  DESATIVADO: 'Desativado',
};

const CORES_STATUS: Record<Status, string> = {
  ATIVO: 'bg-lime/10 border-lime/30 text-lime',
  DESATIVADO: 'bg-muted border-border text-muted-foreground',
};

export default function OrgaosPage() {
  const [orgaos, setOrgaos] = useState<Orgao[]>(ORGAOS_INICIAIS);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('TODOS');
  const [pagina, setPagina] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [orgaoEditando, setOrgaoEditando] = useState<Orgao | null>(null);
  const [dadosParaDesativar, setDadosParaDesativar] =
    useState<FormularioOrgao | null>(null);
  const [formulario, setFormulario] = useState<FormularioOrgao>(FORMULARIO_INICIAL);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);

  const orgaosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const cnpjTermo = termo.replace(/\D/g, '');
    return orgaos.filter((orgao) => {
      const correspondeBusca =
        !termo ||
        orgao.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
        (cnpjTermo !== '' && orgao.cnpj.includes(cnpjTermo));
      const correspondeStatus = filtroStatus === 'TODOS' || orgao.status === filtroStatus;
      return correspondeBusca && correspondeStatus;
    });
  }, [busca, orgaos, filtroStatus]);

  const totalPaginas = Math.max(1, Math.ceil(orgaosFiltrados.length / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);
  const orgaosPaginados = useMemo(() => {
    const inicio = (paginaAtual - 1) * ITENS_POR_PAGINA;
    return orgaosFiltrados.slice(inicio, inicio + ITENS_POR_PAGINA);
  }, [orgaosFiltrados, paginaAtual]);

  const estatisticas = useMemo(
    () => ({
      total: orgaos.length,
      ativos: orgaos.filter((orgao) => orgao.status === 'ATIVO').length,
      desativados: orgaos.filter((orgao) => orgao.status === 'DESATIVADO').length,
    }),
    [orgaos],
  );

  function abrirCadastro() {
    setOrgaoEditando(null);
    setFormulario(FORMULARIO_INICIAL);
    setErroFormulario(null);
    setModalAberto(true);
  }

  function abrirEdicao(orgao: Orgao) {
    setOrgaoEditando(orgao);
    setFormulario({
      nome: orgao.nome,
      cnpj: formatarCnpj(orgao.cnpj),
      status: orgao.status,
    });
    setErroFormulario(null);
    setModalAberto(true);
  }

  function salvarOrgao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nome = formulario.nome.trim();
    const cnpj = formulario.cnpj.replace(/\D/g, '');

    if (!nome || !cnpj) {
      setErroFormulario('Preencha todos os campos para salvar o órgão.');
      return;
    }

    if (!cnpjValido(cnpj)) {
      setErroFormulario('Informe um CNPJ válido, incluindo os dígitos verificadores.');
      return;
    }

    const cnpjDuplicado = orgaos.some(
      (orgao) => orgao.cnpj === cnpj && orgao.id !== orgaoEditando?.id,
    );
    if (cnpjDuplicado) {
      setErroFormulario('Já existe um órgão cadastrado com esse CNPJ.');
      return;
    }

    const dados = { nome, cnpj, status: formulario.status };
    if (dados.status === 'DESATIVADO' && orgaoEditando?.status !== 'DESATIVADO') {
      setDadosParaDesativar(dados);
      return;
    }
    aplicarOrgao(dados);
  }

  function aplicarOrgao(dados: FormularioOrgao) {
    if (orgaoEditando) {
      setOrgaos((atuais) =>
        atuais.map((orgao) =>
          orgao.id === orgaoEditando.id ? { ...orgao, ...dados } : orgao,
        ),
      );
    } else {
      setOrgaos((atuais) => [{ id: `orgao-${Date.now()}`, ...dados }, ...atuais]);
      setPagina(1);
    }

    setModalAberto(false);
    setOrgaoEditando(null);
    setDadosParaDesativar(null);
    setErroFormulario(null);
  }

  function confirmarDesativacao() {
    if (!dadosParaDesativar) return;
    aplicarOrgao(dadosParaDesativar);
  }

  function fecharModal() {
    setModalAberto(false);
    setDadosParaDesativar(null);
    setErroFormulario(null);
  }

  const colunas: Column<Orgao>[] = [
    {
      header: 'Órgão público',
      key: 'nome',
      render: (_, orgao) => (
        <div>
          <p className="font-medium">{orgao.nome}</p>
          <p className="font-mono text-xs text-muted-foreground">{orgao.id}</p>
        </div>
      ),
    },
    {
      header: 'CNPJ',
      key: 'cnpj',
      render: (cnpj) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {formatarCnpj(String(cnpj))}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (_, orgao) => (
        <span
          className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${CORES_STATUS[orgao.status]}`}
        >
          {ROTULOS_STATUS[orgao.status]}
        </span>
      ),
    },
    {
      header: 'Ações',
      key: 'id',
      render: (_, orgao) => (
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => abrirEdicao(orgao)}
            className="inline-flex items-center gap-1 text-xs font-medium text-aqua hover:underline"
          >
            <Pencil className="size-3" />
            Editar
          </button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Órgãos públicos"
        description="Cadastre e gerencie os órgãos públicos atendidos."
        action={
          <Button type="button" onClick={abrirCadastro}>
            <Plus />
            Novo órgão
          </Button>
        }
      />

      <section className="grid gap-3 sm:grid-cols-3" aria-label="Resumo de órgãos públicos">
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Total de órgãos</p>
          <p className="mt-2 font-display text-2xl font-semibold">{estatisticas.total}</p>
          <p className="mt-1 text-xs text-muted-foreground">órgãos cadastrados</p>
        </article>
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Ativos</p>
          <p className="mt-2 font-display text-2xl font-semibold">{estatisticas.ativos}</p>
          <p className="mt-1 text-xs text-muted-foreground">órgãos em atendimento</p>
        </article>
        <article className="rounded-lg border border-border bg-card px-4 py-4">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Desativados</p>
          <p className="mt-2 font-display text-2xl font-semibold">{estatisticas.desativados}</p>
          <p className="mt-1 text-xs text-muted-foreground">órgãos sem atendimento ativo</p>
        </article>
      </section>

      <section aria-label="Filtros de órgãos" className="grid gap-2.5 sm:grid-cols-2">
        <div className="flex flex-col gap-1">
          <label
            htmlFor="buscaOrgao"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Buscar
          </label>
          <Input
            id="buscaOrgao"
            type="search"
            value={busca}
            onChange={(evento) => {
              setBusca(evento.target.value);
              setPagina(1);
            }}
            placeholder="Buscar por nome ou CNPJ..."
          />
        </div>
        <div className="flex flex-col gap-1">
          <label
            htmlFor="statusOrgao"
            className="font-mono text-[10px] uppercase text-muted-foreground"
          >
            Status
          </label>
          <Select
            id="statusOrgao"
            value={filtroStatus}
            onChange={(evento) => {
              setFiltroStatus(evento.target.value as FiltroStatus);
              setPagina(1);
            }}
          >
            <option value="TODOS">Todos os status</option>
            <option value="ATIVO">Ativo</option>
            <option value="DESATIVADO">Desativado</option>
          </Select>
        </div>
      </section>

      <DataTable<Orgao>
        columns={colunas}
        data={orgaosPaginados}
        currentPage={paginaAtual}
        totalPages={totalPaginas}
        onPageChange={setPagina}
        rowKey="id"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={salvarOrgao}
            className="w-full max-w-xl rounded-xl bg-card p-6 shadow-xl"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-orgao"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <h2 id="titulo-modal-orgao" className="text-xl font-semibold">
                  {orgaoEditando ? 'Editar órgão' : 'Cadastrar órgão'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Informe os dados do órgão público.
                </p>
              </div>
              <button
                type="button"
                onClick={fecharModal}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Fechar modal"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="flex flex-col gap-1">
                <label htmlFor="nomeOrgao" className="text-sm font-medium">
                  Nome do órgão
                </label>
                <Input
                  id="nomeOrgao"
                  required
                  maxLength={160}
                  autoFocus
                  placeholder="Ex.: Defesa Civil municipal"
                  value={formulario.nome}
                  onChange={(evento) =>
                    setFormulario((atual) => ({ ...atual, nome: evento.target.value }))
                  }
                />
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="cnpjOrgao" className="text-sm font-medium">
                    CNPJ
                  </label>
                  <Input
                    id="cnpjOrgao"
                    required
                    inputMode="numeric"
                    autoComplete="off"
                    maxLength={18}
                    placeholder="00.000.000/0000-00"
                    value={formulario.cnpj}
                    aria-describedby="ajudaCnpjOrgao"
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        cnpj: formatarCnpj(evento.target.value),
                      }))
                    }
                  />
                  <p id="ajudaCnpjOrgao" className="text-xs text-muted-foreground">
                    O CNPJ será validado pelos dígitos verificadores antes de salvar.
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="statusModalOrgao" className="text-sm font-medium">
                    Status
                  </label>
                  <Select
                    id="statusModalOrgao"
                    value={formulario.status}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        status: evento.target.value as Status,
                      }))
                    }
                  >
                    <option value="ATIVO">Ativo</option>
                    <option value="DESATIVADO">Desativado</option>
                  </Select>
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
              <Button type="button" variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button type="submit">
                {orgaoEditando ? 'Salvar alterações' : 'Cadastrar órgão'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {dadosParaDesativar && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacao-desativacao"
          >
            <h2 id="titulo-confirmacao-desativacao" className="text-lg font-semibold">
              Confirmar desativação do órgão?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>{dadosParaDesativar.nome}</strong> será marcado como desativado. Deseja
              continuar?
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => setDadosParaDesativar(null)}
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={confirmarDesativacao}
                className="bg-warning text-warning-foreground hover:opacity-90"
              >
                Desativar órgão
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
