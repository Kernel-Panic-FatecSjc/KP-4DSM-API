'use client';

import { Check, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import { DataTable, type Column } from '@/components/DataTable';
import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import {
  api,
  ErroApi,
  type ContratoApi,
  type ContratoPayload,
  type ContratosPaginadosApi,
  type OrgaoApi,
  type StatusContratoApi,
} from '@/lib/api';
import { formatarCnpj } from '@/lib/cnpj';

const ITENS_POR_PAGINA = 5;
const STATUS_CONTRATO: StatusContratoApi[] = [
  'RASCUNHO',
  'VIGENTE',
  'SUSPENSO',
  'ENCERRADO',
];

const ROTULOS_STATUS: Record<StatusContratoApi, string> = {
  RASCUNHO: 'Rascunho',
  VIGENTE: 'Vigente',
  SUSPENSO: 'Suspenso',
  ENCERRADO: 'Encerrado',
};

const CORES_STATUS: Record<StatusContratoApi, string> = {
  RASCUNHO: 'bg-muted border-border text-muted-foreground',
  VIGENTE: 'bg-lime/10 border-lime/30 text-lime',
  SUSPENSO: 'bg-warning/10 border-warning/30 text-warning',
  ENCERRADO: 'bg-muted border-border text-muted-foreground',
};

const TRANSICOES_PERMITIDAS: Record<StatusContratoApi, StatusContratoApi[]> = {
  RASCUNHO: ['RASCUNHO', 'VIGENTE', 'ENCERRADO'],
  VIGENTE: ['VIGENTE', 'SUSPENSO', 'ENCERRADO'],
  SUSPENSO: ['SUSPENSO', 'VIGENTE', 'ENCERRADO'],
  ENCERRADO: [],
};

interface FormularioContrato {
  numero: string;
  objeto: string;
  orgaoId: string;
  inicioVigencia: string;
  fimVigencia: string;
  status: StatusContratoApi;
}

type ConfirmacaoStatus =
  | { tipo: 'salvar'; contrato: ContratoApi | null; dados: ContratoPayload }
  | { tipo: 'encerrar'; contrato: ContratoApi };

const FORMULARIO_INICIAL: FormularioContrato = {
  numero: '',
  objeto: '',
  orgaoId: '',
  inicioVigencia: '',
  fimVigencia: '',
  status: 'RASCUNHO',
};

function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(
    new Date(data),
  );
}

function dataParaCampo(data: string): string {
  return data.slice(0, 10);
}

function mensagemErro(erro: unknown, padrao: string): string {
  return erro instanceof Error ? erro.message : padrao;
}

export default function ContratosPage() {
  const router = useRouter();
  const usuario = useUsuario();
  const [contratos, setContratos] = useState<ContratoApi[]>([]);
  const [orgaos, setOrgaos] = useState<OrgaoApi[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroPagina, setErroPagina] = useState<string | null>(null);
  const [erroOrgaos, setErroOrgaos] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusContratoApi | 'TODOS'>('TODOS');
  const [filtroOrgao, setFiltroOrgao] = useState('TODOS');
  const [pagina, setPagina] = useState(1);
  const [versao, setVersao] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [contratoEditando, setContratoEditando] = useState<ContratoApi | null>(null);
  const [formulario, setFormulario] = useState<FormularioContrato>(FORMULARIO_INICIAL);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [confirmacaoStatus, setConfirmacaoStatus] = useState<ConfirmacaoStatus | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);

  const ehAdministrador = usuario?.tipo === 'ADMINISTRADOR';

  function atualizarLista() {
    setCarregando(true);
    setVersao((atual) => atual + 1);
  }

  useEffect(() => {
    if (!ehAdministrador) return;

    let ativo = true;
    api<OrgaoApi[]>('/orgaos')
      .then((resposta) => {
        if (ativo) {
          setOrgaos(resposta);
          setErroOrgaos(null);
        }
      })
      .catch((erro: unknown) => {
        if (!ativo) return;
        if (erro instanceof ErroApi && erro.status === 401) {
          router.replace('/login?proximo=%2Fcontratos');
          return;
        }
        setErroOrgaos(mensagemErro(erro, 'Não foi possível carregar os órgãos.'));
      });

    return () => {
      ativo = false;
    };
  }, [ehAdministrador, router]);

  useEffect(() => {
    if (!ehAdministrador) {
      return;
    }

    let ativo = true;
    const parametros = new URLSearchParams({
      pagina: String(pagina),
      tamanho: String(ITENS_POR_PAGINA),
    });
    if (busca.trim()) parametros.set('busca', busca.trim());
    if (filtroStatus !== 'TODOS') parametros.set('status', filtroStatus);
    if (filtroOrgao !== 'TODOS') parametros.set('orgaoId', filtroOrgao);

    api<ContratosPaginadosApi>(`/contratos?${parametros.toString()}`)
      .then((resposta) => {
        if (!ativo) return;
        setContratos(resposta.contratos);
        setTotal(resposta.total);
        setErroPagina(null);
      })
      .catch((erro: unknown) => {
        if (!ativo) return;
        if (erro instanceof ErroApi && erro.status === 401) {
          router.replace('/login?proximo=%2Fcontratos');
          return;
        }
        setErroPagina(mensagemErro(erro, 'Não foi possível carregar os contratos.'));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [busca, ehAdministrador, filtroOrgao, filtroStatus, pagina, router, versao]);

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);

  const orgaosAtivos = useMemo(() => orgaos.filter((orgao) => orgao.ativo), [orgaos]);
  const opcoesOrgaos = useMemo(
    () => orgaos.filter((orgao) => orgao.ativo || orgao.id === contratoEditando?.orgao.id),
    [contratoEditando, orgaos],
  );

  function abrirCadastro() {
    setContratoEditando(null);
    setFormulario({ ...FORMULARIO_INICIAL, orgaoId: orgaosAtivos[0]?.id ?? '' });
    setErroFormulario(null);
    setModalAberto(true);
  }

  function abrirEdicao(contrato: ContratoApi) {
    setContratoEditando(contrato);
    setFormulario({
      numero: contrato.numero,
      objeto: contrato.objeto,
      orgaoId: contrato.orgao.id,
      inicioVigencia: dataParaCampo(contrato.inicioVigencia),
      fimVigencia: dataParaCampo(contrato.fimVigencia),
      status: contrato.status,
    });
    setErroFormulario(null);
    setModalAberto(true);
  }

  function validarFormulario(): ContratoPayload | null {
    const numero = formulario.numero.trim();
    const objeto = formulario.objeto.trim();

    if (!numero || !objeto || !formulario.orgaoId) {
      setErroFormulario('Preencha o número, o objeto e selecione um órgão ativo.');
      return null;
    }
    if (numero.length > 100 || objeto.length > 2000) {
      setErroFormulario('O número aceita até 100 caracteres e o objeto até 2000.');
      return null;
    }
    if (!formulario.inicioVigencia || !formulario.fimVigencia) {
      setErroFormulario('Informe as datas de início e fim da vigência.');
      return null;
    }

    const inicio = new Date(`${formulario.inicioVigencia}T00:00:00.000Z`);
    const fim = new Date(`${formulario.fimVigencia}T23:59:59.999Z`);
    if (Number.isNaN(inicio.getTime()) || Number.isNaN(fim.getTime())) {
      setErroFormulario('Informe datas de vigência válidas.');
      return null;
    }
    if (fim.getTime() < inicio.getTime()) {
      setErroFormulario('O fim da vigência deve ser igual ou posterior ao início.');
      return null;
    }

    const orgaoSelecionado = orgaos.find((orgao) => orgao.id === formulario.orgaoId);
    if (
      !orgaoSelecionado ||
      (!orgaoSelecionado.ativo && orgaoSelecionado.id !== contratoEditando?.orgao.id)
    ) {
      setErroFormulario('Selecione um órgão ativo cadastrado.');
      return null;
    }

    const ativandoContrato =
      formulario.status === 'VIGENTE' &&
      (!contratoEditando || contratoEditando.status !== 'VIGENTE');
    if (
      ativandoContrato &&
      fim.getTime() < Date.now()
    ) {
      setErroFormulario('Contrato com vigência expirada não pode ser ativado.');
      return null;
    }

    if (contratoEditando) {
      const transicoes = TRANSICOES_PERMITIDAS[contratoEditando.status];
      if (!transicoes.includes(formulario.status)) {
        setErroFormulario(
          `Não é permitido alterar o status de ${ROTULOS_STATUS[contratoEditando.status]} para ${ROTULOS_STATUS[formulario.status]}.`,
        );
        return null;
      }
    } else if (formulario.status === 'SUSPENSO') {
      setErroFormulario('Um contrato novo não pode ser cadastrado como suspenso.');
      return null;
    }

    return {
      numero,
      objeto,
      orgaoId: formulario.orgaoId,
      inicioVigencia: formulario.inicioVigencia,
      fimVigencia: formulario.fimVigencia,
      status: formulario.status,
    };
  }

  async function persistirContrato(
    contrato: ContratoApi | null,
    dados: ContratoPayload,
  ) {
    setSalvando(true);
    try {
      await api<ContratoApi>(
        contrato ? `/contratos/${contrato.id}` : '/contratos',
        {
          method: contrato ? 'PATCH' : 'POST',
          body: JSON.stringify(dados),
        },
      );
      setModalAberto(false);
      setContratoEditando(null);
      setErroFormulario(null);
      setConfirmacaoStatus(null);
      if (!contrato) setPagina(1);
      atualizarLista();
    } catch (erro: unknown) {
      setErroFormulario(mensagemErro(erro, 'Não foi possível salvar o contrato.'));
      setConfirmacaoStatus(null);
    } finally {
      setSalvando(false);
    }
  }

  function salvarContrato(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroFormulario(null);
    const dados = validarFormulario();
    if (!dados) return;

    if (dados.status !== (contratoEditando?.status ?? 'RASCUNHO')) {
      setErroConfirmacao(null);
      setConfirmacaoStatus({ tipo: 'salvar', contrato: contratoEditando, dados });
      return;
    }
    void persistirContrato(contratoEditando, dados);
  }

  async function confirmarMudancaStatus() {
    if (!confirmacaoStatus) return;
    setSalvando(true);
    setErroConfirmacao(null);
    try {
      if (confirmacaoStatus.tipo === 'encerrar') {
        await api<ContratoApi>(`/contratos/${confirmacaoStatus.contrato.id}/encerrar`, {
          method: 'PATCH',
        });
        atualizarLista();
      } else {
        const { contrato, dados } = confirmacaoStatus;
        await api<ContratoApi>(contrato ? `/contratos/${contrato.id}` : '/contratos', {
          method: contrato ? 'PATCH' : 'POST',
          body: JSON.stringify(dados),
        });
        setModalAberto(false);
        setContratoEditando(null);
        setErroFormulario(null);
        if (!contrato) setPagina(1);
        atualizarLista();
      }
      setConfirmacaoStatus(null);
    } catch (erro: unknown) {
      setErroConfirmacao(mensagemErro(erro, 'Não foi possível alterar o status do contrato.'));
    } finally {
      setSalvando(false);
    }
  }

  const colunas: Column<ContratoApi>[] = [
    {
      header: 'Número do contrato',
      key: 'numero',
      render: (_, contrato) => (
        <div className="min-w-40">
          <p className="font-medium">{contrato.numero}</p>
          <p className="mt-1 max-w-64 text-xs text-muted-foreground">{contrato.objeto}</p>
        </div>
      ),
    },
    {
      header: 'Órgão público / CNPJ',
      key: 'orgao',
      render: (_, contrato) => (
        <div>
          <p>{contrato.orgao.nome}</p>
          <p className="mt-1 whitespace-nowrap font-mono text-xs text-muted-foreground">
            {contrato.orgao.cnpj ? formatarCnpj(contrato.orgao.cnpj) : 'CNPJ não informado'}
          </p>
        </div>
      ),
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
          className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${CORES_STATUS[contrato.status]}`}
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
          {contrato.status !== 'ENCERRADO' && (
            <>
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
                onClick={() => {
                  setErroConfirmacao(null);
                  setConfirmacaoStatus({ tipo: 'encerrar', contrato });
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline"
              >
                <Check className="size-3" />
                Encerrar
              </button>
            </>
          )}
        </div>
      ),
    },
  ];

  if (!usuario) {
    return <p className="p-6 text-sm text-muted-foreground">Carregando perfil...</p>;
  }

  if (!ehAdministrador) {
    return (
      <div role="alert" className="rounded-md border border-border bg-card p-6 text-sm">
        Esta página está disponível somente para administradores.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <PageHeading
        title="Contratos e licitações"
        description="Gerencie contratos públicos, órgãos contratantes e períodos de vigência."
        action={
          <Button type="button" onClick={abrirCadastro} disabled={orgaosAtivos.length === 0}>
            <Plus />
            Novo contrato
          </Button>
        }
      />

      <section aria-label="Resumo de contratos">
        <article className="w-full rounded-lg border border-border bg-card px-4 py-4 sm:max-w-xs">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">
            Contratos encontrados
          </p>
          <p className="mt-2 font-display text-2xl font-semibold">{total}</p>
        </article>
      </section>

      {erroOrgaos && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          Não foi possível carregar a lista de órgãos: {erroOrgaos}
        </div>
      )}
      {erroPagina && (
        <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
          {erroPagina}
          <Button
            type="button"
            variant="outline"
            className="ml-3"
            onClick={atualizarLista}
          >
            Tentar novamente
          </Button>
        </div>
      )}

      <section aria-label="Filtros de contratos" className="grid gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="buscaContrato" className="font-mono text-[10px] uppercase text-muted-foreground">
            Buscar por número
          </label>
          <Input
            id="buscaContrato"
            type="search"
            value={busca}
            onChange={(evento) => {
              setCarregando(true);
              setBusca(evento.target.value);
              setPagina(1);
            }}
            placeholder="Número, objeto ou órgão..."
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="statusContrato" className="font-mono text-[10px] uppercase text-muted-foreground">
            Status
          </label>
          <Select
            id="statusContrato"
            value={filtroStatus}
            onChange={(evento) => {
              setCarregando(true);
              setFiltroStatus(evento.target.value as StatusContratoApi | 'TODOS');
              setPagina(1);
            }}
          >
            <option value="TODOS">Todos os status</option>
            {STATUS_CONTRATO.map((status) => (
              <option key={status} value={status}>{ROTULOS_STATUS[status]}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="orgaoFiltroContrato" className="font-mono text-[10px] uppercase text-muted-foreground">
            Órgão
          </label>
          <Select
            id="orgaoFiltroContrato"
            value={filtroOrgao}
            onChange={(evento) => {
              setCarregando(true);
              setFiltroOrgao(evento.target.value);
              setPagina(1);
            }}
          >
            <option value="TODOS">Todos os órgãos</option>
            {orgaos.map((orgao) => (
              <option key={orgao.id} value={orgao.id}>{orgao.nome}</option>
            ))}
          </Select>
        </div>
      </section>

      {carregando ? (
        <p className="py-8 text-center text-sm text-muted-foreground">Carregando contratos...</p>
      ) : (
        <DataTable<ContratoApi>
          columns={colunas}
          data={contratos}
          currentPage={paginaAtual}
          totalPages={totalPaginas}
          onPageChange={(novaPagina) => {
            setCarregando(true);
            setPagina(novaPagina);
          }}
          rowKey="id"
        />
      )}

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
                  O CNPJ exibido na listagem é obtido do órgão selecionado.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalAberto(false)}
                className="rounded-md p-2 hover:bg-muted"
                aria-label="Fechar modal"
              >
                <X className="size-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="numeroContrato" className="text-sm font-medium">Número do contrato</label>
                  <Input
                    id="numeroContrato"
                    required
                    maxLength={100}
                    autoFocus
                    value={formulario.numero}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, numero: evento.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="statusModalContrato" className="text-sm font-medium">Status</label>
                  <Select
                    id="statusModalContrato"
                    value={formulario.status}
                    disabled={contratoEditando?.status === 'ENCERRADO'}
                    onChange={(evento) =>
                      setFormulario((atual) => ({
                        ...atual,
                        status: evento.target.value as StatusContratoApi,
                      }))
                    }
                  >
                    {STATUS_CONTRATO.filter((status) =>
                      contratoEditando
                        ? TRANSICOES_PERMITIDAS[contratoEditando.status].includes(status)
                        : status !== 'SUSPENSO',
                    ).map((status) => (
                      <option key={status} value={status}>{ROTULOS_STATUS[status]}</option>
                    ))}
                  </Select>
                </div>
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="objetoContrato" className="text-sm font-medium">Objeto</label>
                <textarea
                  id="objetoContrato"
                  required
                  maxLength={2000}
                  rows={3}
                  value={formulario.objeto}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, objeto: evento.target.value }))}
                  className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                />
              </div>

              <div className="flex flex-col gap-1">
                <label htmlFor="orgaoContrato" className="text-sm font-medium">Órgão público</label>
                <Select
                  id="orgaoContrato"
                  required
                  value={formulario.orgaoId}
                  disabled={orgaosAtivos.length === 0}
                  onChange={(evento) => setFormulario((atual) => ({ ...atual, orgaoId: evento.target.value }))}
                >
                  <option value="" disabled>Selecione um órgão ativo</option>
                  {opcoesOrgaos.map((orgao) => (
                    <option key={orgao.id} value={orgao.id}>
                      {orgao.nome}{orgao.cnpj ? ` — ${formatarCnpj(orgao.cnpj)}` : ''}
                      {!orgao.ativo ? ' (inativo)' : ''}
                    </option>
                  ))}
                </Select>
                {orgaos.length === 0 && (
                  <p className="text-xs text-muted-foreground">
                    Cadastre ou ative um órgão antes de criar contratos.
                  </p>
                )}
              </div>

              <div className="grid gap-4 sm:grid-cols-2">
                <div className="flex flex-col gap-1">
                  <label htmlFor="inicioVigencia" className="text-sm font-medium">Início da vigência</label>
                  <Input
                    id="inicioVigencia"
                    type="date"
                    required
                    value={formulario.inicioVigencia}
                    onChange={(evento) =>
                      setFormulario((atual) => ({ ...atual, inicioVigencia: evento.target.value }))
                    }
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="fimVigencia" className="text-sm font-medium">Fim da vigência</label>
                  <Input
                    id="fimVigencia"
                    type="date"
                    required
                    min={formulario.inicioVigencia || undefined}
                    value={formulario.fimVigencia}
                    onChange={(evento) =>
                      setFormulario((atual) => ({ ...atual, fimVigencia: evento.target.value }))
                    }
                  />
                </div>
              </div>

              {erroFormulario && (
                <div role="alert" className="rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                  {erroFormulario}
                </div>
              )}
            </div>

            <div className="mt-6 flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setModalAberto(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando || Boolean(erroOrgaos)}>
                {salvando ? 'Salvando...' : contratoEditando ? 'Salvar alterações' : 'Cadastrar contrato'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {confirmacaoStatus && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-4">
          <div
            className="w-full max-w-md rounded-xl bg-card p-6 shadow-xl"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacao-status"
          >
            <h2 id="titulo-confirmacao-status" className="text-lg font-semibold">
              Confirmar mudança de status?
            </h2>
            <p className="mt-2 text-sm text-muted-foreground">
              {confirmacaoStatus.tipo === 'encerrar'
                ? <>O contrato <strong>{confirmacaoStatus.contrato.numero}</strong> será marcado como encerrado.</>
                : <>
                    O contrato {confirmacaoStatus.contrato && <strong>{confirmacaoStatus.contrato.numero}</strong>}
                    {confirmacaoStatus.contrato ? ' terá o status alterado para ' : ' será cadastrado com o status '}
                    <strong>{ROTULOS_STATUS[confirmacaoStatus.dados.status]}</strong>.
                  </>}
              {' '}Deseja continuar?
            </p>
            {erroConfirmacao && (
              <div role="alert" className="mt-4 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive">
                {erroConfirmacao}
              </div>
            )}
            <div className="mt-6 flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                disabled={salvando}
                onClick={() => setConfirmacaoStatus(null)}
              >
                Voltar
              </Button>
              <Button type="button" disabled={salvando} onClick={() => void confirmarMudancaStatus()}>
                {salvando ? 'Salvando...' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
