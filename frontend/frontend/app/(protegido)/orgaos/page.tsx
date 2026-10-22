'use client';

import { Pencil, Plus, X } from 'lucide-react';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type KeyboardEvent,
} from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  api,
  ErroApi,
  type CriarOrgaoPayload,
  type EsferaOrgaoApi,
  type OrgaoApi,
  type Usuario,
} from '@/lib/api';
import { cnpjValido, formatarCnpj, limparCnpj } from '@/lib/cnpj';

const ITENS_POR_PAGINA = 5;

type Status = 'ATIVO' | 'DESATIVADO';
type FiltroStatus = Status | 'TODOS';

type Orgao = OrgaoApi;

interface FormularioOrgao extends Omit<CriarOrgaoPayload, 'ativo'> {
  cnpj: string;
  status: Status;
}

type DadosOrgao = Omit<FormularioOrgao, 'status'> & { status: Status };

const FORMULARIO_INICIAL: FormularioOrgao = {
  nome: '',
  cnpj: '',
  esfera: 'MUNICIPAL',
  municipio: '',
  uf: '',
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

const SELETOR_FOCAVEL =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Teclado dentro de um diálogo (RNF11): Esc fecha e o Tab circula pelos
 * controles do próprio diálogo, sem passar para a página atrás dele.
 */
function tratarTecladoNoDialogo(evento: KeyboardEvent<HTMLElement>, fechar: () => void) {
  if (evento.key === 'Escape') {
    evento.stopPropagation();
    fechar();
    return;
  }
  if (evento.key !== 'Tab') return;

  const focaveis = evento.currentTarget.querySelectorAll<HTMLElement>(SELETOR_FOCAVEL);
  const primeiro = focaveis[0];
  const ultimo = focaveis[focaveis.length - 1];
  if (evento.shiftKey && document.activeElement === primeiro) {
    evento.preventDefault();
    ultimo.focus();
  } else if (!evento.shiftKey && document.activeElement === ultimo) {
    evento.preventDefault();
    primeiro.focus();
  }
}

export default function OrgaosPage() {
  const router = useRouter();
  const [orgaos, setOrgaos] = useState<Orgao[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroPagina, setErroPagina] = useState<string | null>(null);
  const [ehAdministrador, setEhAdministrador] = useState(false);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<FiltroStatus>('TODOS');
  const [pagina, setPagina] = useState(1);
  const [modalAberto, setModalAberto] = useState(false);
  const [orgaoEditando, setOrgaoEditando] = useState<Orgao | null>(null);
  const [dadosParaDesativar, setDadosParaDesativar] =
    useState<FormularioOrgao | null>(null);
  const [formulario, setFormulario] = useState<FormularioOrgao>(FORMULARIO_INICIAL);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  // Ao fechar o diálogo, o foco volta para o botão que o abriu.
  const gatilhoDoModal = useRef<HTMLElement | null>(null);
  const botaoSalvar = useRef<HTMLButtonElement>(null);

  const carregarDados = useCallback(async () => {
    try {
      const [orgaosResposta, perfil] = await Promise.all([
        api<OrgaoApi[]>('/orgaos'),
        api<Usuario>('/autenticacao/perfil'),
      ]);
      setOrgaos(orgaosResposta);
      setEhAdministrador(perfil.tipo === 'ADMINISTRADOR');
      setErroPagina(null);
    } catch (erro: unknown) {
      if (erro instanceof ErroApi && erro.status === 401) {
        router.push('/login?proximo=/orgaos');
        return;
      }
      setErroPagina(
        erro instanceof Error ? erro.message : 'Não foi possível carregar os órgãos públicos.',
      );
    } finally {
      setCarregando(false);
    }
  }, [router]);

  useEffect(() => {
    queueMicrotask(() => void carregarDados());
  }, [carregarDados]);

  const orgaosFiltrados = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    const cnpjTermo = limparCnpj(termo);
    return orgaos.filter((orgao) => {
      const correspondeBusca =
        !termo ||
        orgao.nome.toLocaleLowerCase('pt-BR').includes(termo) ||
        orgao.municipio.toLocaleLowerCase('pt-BR').includes(termo) ||
        (cnpjTermo !== '' && (orgao.cnpj ?? '').includes(cnpjTermo));
      const status: Status = orgao.ativo ? 'ATIVO' : 'DESATIVADO';
      const correspondeStatus = filtroStatus === 'TODOS' || status === filtroStatus;
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
      ativos: orgaos.filter((orgao) => orgao.ativo).length,
      desativados: orgaos.filter((orgao) => !orgao.ativo).length,
    }),
    [orgaos],
  );

  function lembrarGatilhoDoModal() {
    gatilhoDoModal.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
  }

  function abrirCadastro() {
    lembrarGatilhoDoModal();
    setOrgaoEditando(null);
    setFormulario(FORMULARIO_INICIAL);
    setErroFormulario(null);
    setModalAberto(true);
  }

  function abrirEdicao(orgao: Orgao) {
    lembrarGatilhoDoModal();
    setOrgaoEditando(orgao);
    setFormulario({
      nome: orgao.nome,
      cnpj: formatarCnpj(orgao.cnpj ?? ''),
      esfera: orgao.esfera,
      municipio: orgao.municipio,
      uf: orgao.uf,
      status: orgao.ativo ? 'ATIVO' : 'DESATIVADO',
    });
    setErroFormulario(null);
    setModalAberto(true);
  }

  function salvarOrgao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    const nome = formulario.nome.trim();
    const cnpj = limparCnpj(formulario.cnpj);
    const municipio = formulario.municipio.trim();
    const uf = formulario.uf.trim().toUpperCase();

    if (!nome || !municipio || !uf) {
      setErroFormulario('Preencha nome, município e UF para salvar o órgão.');
      return;
    }

    if (cnpj && !cnpjValido(cnpj)) {
      setErroFormulario('Informe um CNPJ válido, incluindo os dígitos verificadores.');
      return;
    }

    const cnpjDuplicado =
      Boolean(cnpj) &&
      orgaos.some(
        (orgao) => orgao.cnpj === cnpj && orgao.id !== orgaoEditando?.id,
      );
    if (cnpjDuplicado) {
      setErroFormulario('Já existe um órgão cadastrado com esse CNPJ.');
      return;
    }

    const dados = {
      nome,
      cnpj,
      esfera: formulario.esfera,
      municipio,
      uf,
      status: formulario.status,
    };
    if (dados.status === 'DESATIVADO' && orgaoEditando?.ativo) {
      setDadosParaDesativar(dados);
      return;
    }
    void aplicarOrgao(dados);
  }

  async function aplicarOrgao(dados: DadosOrgao) {
    const { status, ...dadosOrgao } = dados;
    const payload: CriarOrgaoPayload = {
      ...dadosOrgao,
      ...(dadosOrgao.cnpj
        ? { cnpj: dadosOrgao.cnpj }
        : orgaoEditando?.cnpj
          ? { cnpj: null }
          : {}),
    };
    setSalvando(true);
    setErroFormulario(null);
    try {
      if (orgaoEditando) {
        await api<OrgaoApi>(`/orgaos/${orgaoEditando.id}`, {
          method: 'PATCH',
          body: JSON.stringify({
            ...payload,
            ...(status === 'ATIVO' && !orgaoEditando.ativo ? { ativo: true } : {}),
          }),
        });
        if (status === 'DESATIVADO' && orgaoEditando.ativo) {
          await api<OrgaoApi>(`/orgaos/${orgaoEditando.id}`, { method: 'DELETE' });
        }
      } else {
        await api<OrgaoApi>('/orgaos', {
          method: 'POST',
          body: JSON.stringify({ ...payload, ativo: status === 'ATIVO' }),
        });
        setPagina(1);
      }
      fecharModal();
      await carregarDados();
    } catch (erro: unknown) {
      if (erro instanceof ErroApi && erro.status === 401) {
        router.push('/login?proximo=/orgaos');
        return;
      }
      setErroFormulario(
        erro instanceof Error ? erro.message : 'Não foi possível salvar o órgão.',
      );
      await carregarDados();
    } finally {
      setSalvando(false);
    }
  }

  function confirmarDesativacao() {
    if (!dadosParaDesativar) return;
    void aplicarOrgao(dadosParaDesativar);
  }

  function voltarDaConfirmacao() {
    setDadosParaDesativar(null);
    botaoSalvar.current?.focus();
  }

  function fecharModal() {
    setModalAberto(false);
    setOrgaoEditando(null);
    setDadosParaDesativar(null);
    setErroFormulario(null);
    gatilhoDoModal.current?.focus();
    gatilhoDoModal.current = null;
  }

  const colunas: Column<Orgao>[] = [
    {
      header: 'Órgão público',
      key: 'nome',
      render: (_, orgao) => (
        <div>
          <p className="font-medium">{orgao.nome}</p>
          <p className="text-xs text-muted-foreground">
            {orgao.esfera} · {orgao.municipio}/{orgao.uf}
          </p>
        </div>
      ),
    },
    {
      header: 'CNPJ',
      key: 'cnpj',
      render: (cnpj) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {cnpj ? formatarCnpj(String(cnpj)) : 'Não informado'}
        </span>
      ),
    },
    {
      header: 'Status',
      key: 'ativo',
      render: (_, orgao) => (
        <span
          className={`inline-block rounded-full border px-2.5 py-1 text-xs font-semibold ${CORES_STATUS[orgao.ativo ? 'ATIVO' : 'DESATIVADO']}`}
        >
          {ROTULOS_STATUS[orgao.ativo ? 'ATIVO' : 'DESATIVADO']}
        </span>
      ),
    },
    {
      header: 'Ações',
      key: 'id',
      render: (_, orgao) => (
        ehAdministrador ? (
          <button
            type="button"
            onClick={() => abrirEdicao(orgao)}
            className="inline-flex items-center gap-1 text-xs font-medium text-aqua hover:underline"
          >
            <Pencil className="size-3" />
            Editar
          </button>
        ) : (
          <span className="text-xs text-muted-foreground">Somente leitura</span>
        )
      ),
    },
  ];

  return (
    <div className="space-y-5">
      <PageHeading
        title="Órgãos públicos"
        description="Cadastre e gerencie os órgãos públicos atendidos."
        action={
          ehAdministrador ? (
            <Button type="button" onClick={abrirCadastro}>
              <Plus />
              Novo órgão
            </Button>
          ) : undefined
        }
      />

      {erroPagina && (
        <div
          role="alert"
          className="flex flex-wrap items-center justify-between gap-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive"
        >
          <span>{erroPagina}</span>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => {
              setCarregando(true);
              void carregarDados();
            }}
          >
            Tentar novamente
          </Button>
        </div>
      )}

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
        isLoading={carregando}
        rowKey="id"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <form
            onSubmit={salvarOrgao}
            onKeyDown={(evento) => tratarTecladoNoDialogo(evento, fecharModal)}
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
                disabled={salvando}
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
                    autoCapitalize="characters"
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
                    Numérico ou alfanumérico, validado pelos dígitos verificadores antes de salvar.
                  </p>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="esferaOrgao" className="text-sm font-medium">
                    Esfera
                  </label>
                  <Select
                    id="esferaOrgao"
                    value={formulario.esfera}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        esfera: evento.target.value as EsferaOrgaoApi,
                      }))
                    }
                  >
                    <option value="MUNICIPAL">Municipal</option>
                    <option value="ESTADUAL">Estadual</option>
                    <option value="FEDERAL">Federal</option>
                  </Select>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="municipioOrgao" className="text-sm font-medium">
                    Município
                  </label>
                  <Input
                    id="municipioOrgao"
                    required
                    maxLength={160}
                    value={formulario.municipio}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        municipio: evento.target.value,
                      }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="ufOrgao" className="text-sm font-medium">
                    UF
                  </label>
                  <Input
                    id="ufOrgao"
                    required
                    minLength={2}
                    maxLength={2}
                    autoCapitalize="characters"
                    value={formulario.uf}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        uf: evento.target.value.toUpperCase(),
                      }))
                    }
                  />
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
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={fecharModal}
              >
                Cancelar
              </Button>
              <Button ref={botaoSalvar} type="submit" disabled={salvando}>
                {salvando
                  ? 'Salvando...'
                  : orgaoEditando
                    ? 'Salvar alterações'
                    : 'Cadastrar órgão'}
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
            onKeyDown={(evento) => tratarTecladoNoDialogo(evento, voltarDaConfirmacao)}
          >
            <h2 id="titulo-confirmacao-desativacao" className="text-lg font-semibold">
              Confirmar desativação do órgão?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              <strong>{dadosParaDesativar.nome}</strong> será marcado como desativado. Deseja
              continuar?
            </p>
            {erroFormulario && (
              <p role="alert" className="mt-3 text-sm text-destructive">
                {erroFormulario}
              </p>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                autoFocus
                disabled={salvando}
                onClick={voltarDaConfirmacao}
              >
                Voltar
              </Button>
              <Button
                type="button"
                onClick={confirmarDesativacao}
                disabled={salvando}
                className="bg-warning text-warning-foreground hover:opacity-90"
              >
                {salvando ? 'Salvando...' : 'Desativar órgão'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
