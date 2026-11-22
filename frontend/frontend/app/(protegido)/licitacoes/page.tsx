'use client';

import { Ban, MapPin, Pencil, Plus, X } from 'lucide-react';
import { useEffect, useState, type FormEvent, type KeyboardEvent } from 'react';
import Link from 'next/link';
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
  type EsferaOrgaoApi,
  type EstacaoApi,
  type LicitacaoApi,
  type LicitacaoPayload,
  type ModalidadeLicitacao,
  type Paginado,
  type StatusLicitacao,
} from '@/lib/api';
import { cnpjValido, formatarCnpj, limparCnpj } from '@/lib/cnpj';
import { ehTecsus, ROTULO_STATUS_LICITACAO } from '@/lib/perfil';
import { ROTULOS_ESFERA, ROTULOS_MODALIDADE } from '@/lib/licitacoes';

const ITENS_POR_PAGINA = 10;

const STATUS_LICITACAO: StatusLicitacao[] = ['RASCUNHO', 'VIGENTE', 'SUSPENSA', 'ENCERRADA'];

/** Status que o formulário aceita: encerrar tem ação própria. */
type StatusEditavel = Exclude<StatusLicitacao, 'ENCERRADA'>;

const CORES_STATUS: Record<StatusLicitacao, string> = {
  RASCUNHO: 'bg-muted border-border text-muted-foreground',
  VIGENTE: 'bg-lime/10 border-lime/30 text-lime',
  SUSPENSA: 'bg-warning/10 border-warning/30 text-warning',
  ENCERRADA: 'bg-muted border-border text-muted-foreground',
};

const TRANSICOES_PERMITIDAS: Record<StatusEditavel, StatusEditavel[]> = {
  RASCUNHO: ['RASCUNHO', 'VIGENTE'],
  VIGENTE: ['VIGENTE', 'SUSPENSA'],
  SUSPENSA: ['SUSPENSA', 'VIGENTE'],
};

const MODALIDADES: ModalidadeLicitacao[] = [
  'PREGAO',
  'CONCORRENCIA',
  'CONCURSO',
  'LEILAO',
  'DIALOGO_COMPETITIVO',
  'DISPENSA',
  'INEXIGIBILIDADE',
  'OUTRA',
];

const ESFERAS: EsferaOrgaoApi[] = ['MUNICIPAL', 'ESTADUAL', 'FEDERAL'];

interface FormularioLicitacao {
  codigoIdentificador: string;
  numeroProcesso: string;
  modalidade: ModalidadeLicitacao;
  objeto: string;
  numeroContrato: string;
  inicioVigencia: string;
  fimVigencia: string;
  status: StatusEditavel;
  orgaoNome: string;
  orgaoCnpj: string;
  orgaoEsfera: EsferaOrgaoApi;
  orgaoMunicipio: string;
  orgaoUf: string;
}

/** Resposta de POST /licitacoes/:id/estacoes. */
interface ResultadoVinculo {
  licitacaoId: string;
  estacoesVinculadas: number;
  alertasInativados: number;
}

type ConfirmacaoStatus =
  | { tipo: 'salvar'; licitacao: LicitacaoApi | null; dados: LicitacaoPayload & { status: StatusEditavel } }
  | { tipo: 'encerrar'; licitacao: LicitacaoApi };

const FORMULARIO_INICIAL: FormularioLicitacao = {
  codigoIdentificador: '',
  numeroProcesso: '',
  modalidade: 'PREGAO',
  objeto: '',
  numeroContrato: '',
  inicioVigencia: '',
  fimVigencia: '',
  status: 'RASCUNHO',
  orgaoNome: '',
  orgaoCnpj: '',
  orgaoEsfera: 'MUNICIPAL',
  orgaoMunicipio: '',
  orgaoUf: '',
};

const CLASSE_ERRO =
  'rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive';

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

function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(data));
}

function dataParaCampo(data: string): string {
  return data.slice(0, 10);
}

function mensagemErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroApi ? erro.message : padrao;
}

function plural(quantidade: number, singular: string, pluralizado: string): string {
  return `${quantidade} ${quantidade === 1 ? singular : pluralizado}`;
}

function SeloStatus({ status }: { status: StatusLicitacao }) {
  return (
    <span
      className={`inline-block whitespace-nowrap rounded-full border px-2.5 py-1 text-xs font-semibold ${CORES_STATUS[status]}`}
    >
      {ROTULO_STATUS_LICITACAO[status]}
    </span>
  );
}

export default function LicitacoesPage() {
  const router = useRouter();
  const usuario = useUsuario();
  const [licitacoes, setLicitacoes] = useState<LicitacaoApi[]>([]);
  const [total, setTotal] = useState(0);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [erroPagina, setErroPagina] = useState<string | null>(null);
  const [busca, setBusca] = useState('');
  const [filtroStatus, setFiltroStatus] = useState<StatusLicitacao | 'TODOS'>('TODOS');
  const [filtroEsfera, setFiltroEsfera] = useState<EsferaOrgaoApi | 'TODAS'>('TODAS');
  const [pagina, setPagina] = useState(1);
  const [versao, setVersao] = useState(0);
  const [modalAberto, setModalAberto] = useState(false);
  const [licitacaoEditando, setLicitacaoEditando] = useState<LicitacaoApi | null>(null);
  const [formulario, setFormulario] = useState<FormularioLicitacao>(FORMULARIO_INICIAL);
  const [erroFormulario, setErroFormulario] = useState<string | null>(null);
  const [confirmacaoStatus, setConfirmacaoStatus] = useState<ConfirmacaoStatus | null>(null);
  const [erroConfirmacao, setErroConfirmacao] = useState<string | null>(null);
  const [licitacaoEstacoes, setLicitacaoEstacoes] = useState<LicitacaoApi | null>(null);

  const tecsus = ehTecsus(usuario);

  function atualizarLista() {
    setCarregando(true);
    setVersao((atual) => atual + 1);
  }

  useEffect(() => {
    if (!tecsus) return;

    let ativo = true;
    const parametros = new URLSearchParams({
      pagina: String(pagina),
      tamanho: String(ITENS_POR_PAGINA),
    });
    if (busca.trim()) parametros.set('busca', busca.trim());
    if (filtroStatus !== 'TODOS') parametros.set('status', filtroStatus);
    if (filtroEsfera !== 'TODAS') parametros.set('esfera', filtroEsfera);

    api<Paginado<LicitacaoApi>>(`/licitacoes?${parametros.toString()}`)
      .then((resposta) => {
        if (!ativo) return;
        setLicitacoes(resposta.itens);
        setTotal(resposta.total);
        setErroPagina(null);
      })
      .catch((erro: unknown) => {
        if (!ativo) return;
        if (erro instanceof ErroApi && erro.status === 401) {
          router.replace('/login?proximo=%2Flicitacoes');
          return;
        }
        setErroPagina(mensagemErro(erro, 'Não foi possível carregar as licitações.'));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });

    return () => {
      ativo = false;
    };
  }, [busca, tecsus, filtroEsfera, filtroStatus, pagina, router, versao]);

  const totalPaginas = Math.max(1, Math.ceil(total / ITENS_POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas);

  function abrirCadastro() {
    setLicitacaoEditando(null);
    setFormulario(FORMULARIO_INICIAL);
    setErroFormulario(null);
    setModalAberto(true);
  }

  function abrirEdicao(licitacao: LicitacaoApi) {
    if (licitacao.status === 'ENCERRADA') return;
    setLicitacaoEditando(licitacao);
    setFormulario({
      codigoIdentificador: licitacao.codigoIdentificador,
      numeroProcesso: licitacao.numeroProcesso,
      modalidade: licitacao.modalidade,
      objeto: licitacao.objeto,
      numeroContrato: licitacao.numeroContrato,
      inicioVigencia: dataParaCampo(licitacao.inicioVigencia),
      fimVigencia: dataParaCampo(licitacao.fimVigencia),
      status: licitacao.status,
      orgaoNome: licitacao.orgaoNome,
      orgaoCnpj: formatarCnpj(licitacao.orgaoCnpj ?? ''),
      orgaoEsfera: licitacao.orgaoEsfera,
      orgaoMunicipio: licitacao.orgaoMunicipio,
      orgaoUf: licitacao.orgaoUf,
    });
    setErroFormulario(null);
    setModalAberto(true);
  }

  function fecharModal() {
    if (salvando) return;
    setModalAberto(false);
  }

  function validarFormulario(): (LicitacaoPayload & { status: StatusEditavel }) | null {
    const codigoIdentificador = formulario.codigoIdentificador.trim().toUpperCase();
    const numeroProcesso = formulario.numeroProcesso.trim();
    const objeto = formulario.objeto.trim();
    const numeroContrato = formulario.numeroContrato.trim();
    const orgaoNome = formulario.orgaoNome.trim();
    const orgaoCnpj = limparCnpj(formulario.orgaoCnpj);
    const orgaoMunicipio = formulario.orgaoMunicipio.trim();
    const orgaoUf = formulario.orgaoUf.trim().toUpperCase();

    if (!codigoIdentificador || !numeroProcesso || !objeto || !numeroContrato) {
      setErroFormulario('Preencha o código, o número do processo, o objeto e o número do contrato.');
      return null;
    }
    if (!/^[A-Z0-9][A-Z0-9-]{1,39}$/.test(codigoIdentificador)) {
      setErroFormulario('O código deve ter de 2 a 40 letras, números ou hífens.');
      return null;
    }
    if (!orgaoNome || !orgaoMunicipio || !orgaoUf) {
      setErroFormulario('Preencha o nome, o município e a UF do órgão.');
      return null;
    }
    if (!/^[A-Z]{2}$/.test(orgaoUf)) {
      setErroFormulario('Informe a UF com duas letras.');
      return null;
    }
    if (orgaoCnpj && !cnpjValido(orgaoCnpj)) {
      setErroFormulario('Informe um CNPJ válido, incluindo os dígitos verificadores.');
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

    const ativando =
      formulario.status === 'VIGENTE' && licitacaoEditando?.status !== 'VIGENTE';
    if (ativando && fim.getTime() < Date.now()) {
      setErroFormulario('Licitação com vigência vencida não pode ficar vigente.');
      return null;
    }

    const statusAtual = licitacaoEditando?.status ?? 'RASCUNHO';
    if (statusAtual !== 'ENCERRADA' && !TRANSICOES_PERMITIDAS[statusAtual].includes(formulario.status)) {
      setErroFormulario(
        `Não é permitido mudar o status de ${ROTULO_STATUS_LICITACAO[statusAtual]} para ${ROTULO_STATUS_LICITACAO[formulario.status]}.`,
      );
      return null;
    }

    return {
      codigoIdentificador,
      numeroProcesso,
      modalidade: formulario.modalidade,
      objeto,
      numeroContrato,
      inicioVigencia: formulario.inicioVigencia,
      fimVigencia: formulario.fimVigencia,
      status: formulario.status,
      orgaoNome,
      // null apaga o CNPJ na edição; no cadastro, equivale a não informar.
      orgaoCnpj: orgaoCnpj || null,
      orgaoEsfera: formulario.orgaoEsfera,
      orgaoMunicipio,
      orgaoUf,
    };
  }

  async function persistirLicitacao(licitacao: LicitacaoApi | null, dados: LicitacaoPayload) {
    await api<LicitacaoApi>(licitacao ? `/licitacoes/${licitacao.id}` : '/licitacoes', {
      method: licitacao ? 'PATCH' : 'POST',
      body: JSON.stringify(dados),
    });
    setModalAberto(false);
    setLicitacaoEditando(null);
    setErroFormulario(null);
    if (!licitacao) setPagina(1);
    atualizarLista();
  }

  async function salvarLicitacao(evento: FormEvent<HTMLFormElement>) {
    evento.preventDefault();
    setErroFormulario(null);
    const dados = validarFormulario();
    if (!dados) return;

    if (dados.status !== (licitacaoEditando?.status ?? 'RASCUNHO')) {
      setErroConfirmacao(null);
      setConfirmacaoStatus({ tipo: 'salvar', licitacao: licitacaoEditando, dados });
      return;
    }

    setSalvando(true);
    try {
      await persistirLicitacao(licitacaoEditando, dados);
    } catch (erro: unknown) {
      setErroFormulario(mensagemErro(erro, 'Não foi possível salvar a licitação.'));
    } finally {
      setSalvando(false);
    }
  }

  async function confirmarMudancaStatus() {
    if (!confirmacaoStatus) return;
    setSalvando(true);
    setErroConfirmacao(null);
    try {
      if (confirmacaoStatus.tipo === 'encerrar') {
        await api<LicitacaoApi>(`/licitacoes/${confirmacaoStatus.licitacao.id}/encerrar`, {
          method: 'PATCH',
        });
        atualizarLista();
      } else {
        await persistirLicitacao(confirmacaoStatus.licitacao, confirmacaoStatus.dados);
      }
      setConfirmacaoStatus(null);
    } catch (erro: unknown) {
      setErroConfirmacao(mensagemErro(erro, 'Não foi possível alterar o status da licitação.'));
    } finally {
      setSalvando(false);
    }
  }

  function voltarDaConfirmacao() {
    if (!salvando) setConfirmacaoStatus(null);
  }

  const colunas: Column<LicitacaoApi>[] = [
    {
      header: 'Licitação',
      key: 'codigoIdentificador',
      render: (_, licitacao) => (
        <div className="min-w-48">
          <Link href={`/licitacoes/${licitacao.id}`} className="font-mono font-semibold underline-offset-2 hover:underline">
            {licitacao.codigoIdentificador}
          </Link>
          <p className="mt-1 text-xs text-muted-foreground">
            {ROTULOS_MODALIDADE[licitacao.modalidade]} · Processo {licitacao.numeroProcesso}
          </p>
          <p className="mt-1 max-w-72 text-xs text-muted-foreground">{licitacao.objeto}</p>
        </div>
      ),
    },
    {
      header: 'Órgão',
      key: 'orgaoNome',
      render: (_, licitacao) => (
        <div className="min-w-48">
          <p>{licitacao.orgaoNome}</p>
          <p className="mt-1 whitespace-nowrap font-mono text-xs text-muted-foreground">
            {licitacao.orgaoCnpj ? formatarCnpj(licitacao.orgaoCnpj) : 'CNPJ não informado'}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {ROTULOS_ESFERA[licitacao.orgaoEsfera]} · {licitacao.orgaoMunicipio}/{licitacao.orgaoUf}
          </p>
        </div>
      ),
    },
    {
      header: 'Contrato / vigência',
      key: 'numeroContrato',
      render: (_, licitacao) => (
        <div>
          <p className="whitespace-nowrap">{licitacao.numeroContrato}</p>
          <p className="mt-1 whitespace-nowrap font-mono text-xs text-muted-foreground">
            {formatarData(licitacao.inicioVigencia)} – {formatarData(licitacao.fimVigencia)}
          </p>
        </div>
      ),
    },
    {
      header: 'Status',
      key: 'status',
      render: (_, licitacao) => <SeloStatus status={licitacao.status} />,
    },
    {
      header: 'Estações / usuários',
      key: 'quantidadeEstacoes',
      render: (_, licitacao) => (
        <span className="whitespace-nowrap font-mono text-xs">
          {licitacao.quantidadeEstacoes ?? 0} / {licitacao.quantidadeUsuarios ?? 0}
        </span>
      ),
    },
    {
      header: 'Ações',
      key: 'id',
      render: (_, licitacao) => (
        <div className="flex min-w-36 flex-wrap gap-x-3 gap-y-1">
          <button
            type="button"
            onClick={() => setLicitacaoEstacoes(licitacao)}
            className="inline-flex items-center gap-1 text-xs font-medium text-aqua hover:underline"
          >
            <MapPin className="size-3" />
            Estações
          </button>
          {licitacao.status !== 'ENCERRADA' && (
            <>
              <button
                type="button"
                onClick={() => abrirEdicao(licitacao)}
                className="inline-flex items-center gap-1 text-xs font-medium text-aqua hover:underline"
              >
                <Pencil className="size-3" />
                Editar
              </button>
              <button
                type="button"
                onClick={() => {
                  setErroConfirmacao(null);
                  setConfirmacaoStatus({ tipo: 'encerrar', licitacao });
                }}
                className="inline-flex items-center gap-1 text-xs font-medium text-warning hover:underline"
              >
                <Ban className="size-3" />
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

  if (!tecsus) {
    return (
      <div role="alert" className="rounded-md border border-border bg-card p-6 text-sm">
        Esta página está disponível somente para a Tecsus.
      </div>
    );
  }

  const opcoesStatus: StatusEditavel[] =
    licitacaoEditando && licitacaoEditando.status !== 'ENCERRADA'
      ? TRANSICOES_PERMITIDAS[licitacaoEditando.status]
      : TRANSICOES_PERMITIDAS.RASCUNHO;

  return (
    <div className="space-y-5">
      <PageHeading
        title="Licitações"
        description="Cadastre as licitações ganhas, com o contrato e o órgão contratante, e vincule as estações de cada uma."
        action={
          <Button type="button" onClick={abrirCadastro}>
            <Plus />
            Nova licitação
          </Button>
        }
      />

      <section aria-label="Resumo de licitações">
        <article className="w-full rounded-lg border border-border bg-card px-4 py-4 sm:max-w-xs">
          <p className="font-mono text-[10px] uppercase text-muted-foreground">Licitações encontradas</p>
          <p className="mt-2 font-display text-2xl font-semibold">{total}</p>
        </article>
      </section>

      {erroPagina && (
        <div role="alert" className={`flex flex-wrap items-center justify-between gap-3 ${CLASSE_ERRO}`}>
          <p>{erroPagina}</p>
          <Button type="button" variant="outline" size="sm" onClick={atualizarLista}>
            Tentar novamente
          </Button>
        </div>
      )}

      <section aria-label="Filtros de licitações" className="grid gap-2.5 sm:grid-cols-3">
        <div className="flex flex-col gap-1">
          <label htmlFor="buscaLicitacao" className="font-mono text-[10px] uppercase text-muted-foreground">
            Buscar
          </label>
          <Input
            id="buscaLicitacao"
            type="search"
            value={busca}
            onChange={(evento) => {
              setCarregando(true);
              setBusca(evento.target.value);
              setPagina(1);
            }}
            placeholder="Código, processo, contrato, órgão..."
          />
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="statusLicitacao" className="font-mono text-[10px] uppercase text-muted-foreground">
            Status
          </label>
          <Select
            id="statusLicitacao"
            value={filtroStatus}
            onChange={(evento) => {
              setCarregando(true);
              setFiltroStatus(evento.target.value as StatusLicitacao | 'TODOS');
              setPagina(1);
            }}
          >
            <option value="TODOS">Todos os status</option>
            {STATUS_LICITACAO.map((status) => (
              <option key={status} value={status}>{ROTULO_STATUS_LICITACAO[status]}</option>
            ))}
          </Select>
        </div>
        <div className="flex flex-col gap-1">
          <label htmlFor="esferaLicitacao" className="font-mono text-[10px] uppercase text-muted-foreground">
            Esfera
          </label>
          <Select
            id="esferaLicitacao"
            value={filtroEsfera}
            onChange={(evento) => {
              setCarregando(true);
              setFiltroEsfera(evento.target.value as EsferaOrgaoApi | 'TODAS');
              setPagina(1);
            }}
          >
            <option value="TODAS">Todas as esferas</option>
            {ESFERAS.map((esfera) => (
              <option key={esfera} value={esfera}>{ROTULOS_ESFERA[esfera]}</option>
            ))}
          </Select>
        </div>
      </section>

      <DataTable<LicitacaoApi>
        columns={colunas}
        data={licitacoes}
        currentPage={paginaAtual}
        totalPages={totalPaginas}
        onPageChange={(novaPagina) => {
          setCarregando(true);
          setPagina(novaPagina);
        }}
        isLoading={carregando}
        rowKey="id"
      />

      {modalAberto && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
          <form
            onSubmit={(evento) => void salvarLicitacao(evento)}
            onKeyDown={(evento) => tratarTecladoNoDialogo(evento, fecharModal)}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-4 shadow-xl sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="titulo-modal-licitacao"
            noValidate
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 id="titulo-modal-licitacao" className="text-xl font-semibold">
                  {licitacaoEditando ? 'Editar licitação' : 'Cadastrar licitação'}
                </h2>
                <p className="text-sm text-muted-foreground">
                  Para encerrar, use a ação Encerrar na listagem.
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

            <div className="space-y-5">
              <fieldset className="space-y-4">
                <legend className="mb-3 font-mono text-[10px] uppercase text-muted-foreground">Processo</legend>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="codigoLicitacao" className="text-sm font-medium">Código identificador</label>
                    <Input
                      id="codigoLicitacao"
                      required
                      maxLength={40}
                      autoFocus
                      autoCapitalize="characters"
                      autoComplete="off"
                      placeholder="PMSJC-2026"
                      value={formulario.codigoIdentificador}
                      onChange={(evento) =>
                        setFormulario((atual) => ({ ...atual, codigoIdentificador: evento.target.value.toUpperCase() }))
                      }
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="processoLicitacao" className="text-sm font-medium">Número do processo</label>
                    <Input
                      id="processoLicitacao"
                      required
                      maxLength={100}
                      value={formulario.numeroProcesso}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, numeroProcesso: evento.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="modalidadeLicitacao" className="text-sm font-medium">Modalidade</label>
                    <Select
                      id="modalidadeLicitacao"
                      value={formulario.modalidade}
                      onChange={(evento) =>
                        setFormulario((atual) => ({ ...atual, modalidade: evento.target.value as ModalidadeLicitacao }))
                      }
                    >
                      {MODALIDADES.map((modalidade) => (
                        <option key={modalidade} value={modalidade}>{ROTULOS_MODALIDADE[modalidade]}</option>
                      ))}
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="statusModalLicitacao" className="text-sm font-medium">Status</label>
                    <Select
                      id="statusModalLicitacao"
                      value={formulario.status}
                      onChange={(evento) =>
                        setFormulario((atual) => ({ ...atual, status: evento.target.value as StatusEditavel }))
                      }
                    >
                      {opcoesStatus.map((status) => (
                        <option key={status} value={status}>{ROTULO_STATUS_LICITACAO[status]}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label htmlFor="objetoLicitacao" className="text-sm font-medium">Objeto</label>
                  <textarea
                    id="objetoLicitacao"
                    required
                    maxLength={2000}
                    rows={3}
                    value={formulario.objeto}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, objeto: evento.target.value }))}
                    className="rounded-md border border-input bg-card px-3 py-2 text-sm text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                  />
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="mb-3 font-mono text-[10px] uppercase text-muted-foreground">Contrato</legend>
                <div className="grid gap-4 sm:grid-cols-3">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="contratoLicitacao" className="text-sm font-medium">Número do contrato</label>
                    <Input
                      id="contratoLicitacao"
                      required
                      maxLength={100}
                      value={formulario.numeroContrato}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, numeroContrato: evento.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="inicioVigencia" className="text-sm font-medium">Início da vigência</label>
                    <Input
                      id="inicioVigencia"
                      type="date"
                      required
                      value={formulario.inicioVigencia}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, inicioVigencia: evento.target.value }))}
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
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, fimVigencia: evento.target.value }))}
                    />
                  </div>
                </div>
              </fieldset>

              <fieldset className="space-y-4">
                <legend className="mb-3 font-mono text-[10px] uppercase text-muted-foreground">Órgão contratante</legend>
                <div className="flex flex-col gap-1">
                  <label htmlFor="orgaoNome" className="text-sm font-medium">Nome do órgão</label>
                  <Input
                    id="orgaoNome"
                    required
                    maxLength={200}
                    value={formulario.orgaoNome}
                    onChange={(evento) => setFormulario((atual) => ({ ...atual, orgaoNome: evento.target.value }))}
                  />
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="orgaoCnpj" className="text-sm font-medium">CNPJ (opcional)</label>
                    <Input
                      id="orgaoCnpj"
                      autoCapitalize="characters"
                      autoComplete="off"
                      maxLength={18}
                      placeholder="00.000.000/0000-00"
                      aria-describedby="ajudaCnpjOrgao"
                      value={formulario.orgaoCnpj}
                      onChange={(evento) =>
                        setFormulario((atual) => ({ ...atual, orgaoCnpj: formatarCnpj(evento.target.value) }))
                      }
                    />
                    <p id="ajudaCnpjOrgao" className="text-xs text-muted-foreground">
                      Numérico ou alfanumérico, validado pelos dígitos verificadores.
                    </p>
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="orgaoEsfera" className="text-sm font-medium">Esfera</label>
                    <Select
                      id="orgaoEsfera"
                      value={formulario.orgaoEsfera}
                      onChange={(evento) =>
                        setFormulario((atual) => ({ ...atual, orgaoEsfera: evento.target.value as EsferaOrgaoApi }))
                      }
                    >
                      {ESFERAS.map((esfera) => (
                        <option key={esfera} value={esfera}>{ROTULOS_ESFERA[esfera]}</option>
                      ))}
                    </Select>
                  </div>
                </div>
                <div className="grid grid-cols-[minmax(0,1fr)_5rem] gap-4">
                  <div className="flex flex-col gap-1">
                    <label htmlFor="orgaoMunicipio" className="text-sm font-medium">Município</label>
                    <Input
                      id="orgaoMunicipio"
                      required
                      maxLength={120}
                      value={formulario.orgaoMunicipio}
                      onChange={(evento) => setFormulario((atual) => ({ ...atual, orgaoMunicipio: evento.target.value }))}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label htmlFor="orgaoUf" className="text-sm font-medium">UF</label>
                    <Input
                      id="orgaoUf"
                      required
                      minLength={2}
                      maxLength={2}
                      autoCapitalize="characters"
                      value={formulario.orgaoUf}
                      onChange={(evento) =>
                        setFormulario((atual) => ({ ...atual, orgaoUf: evento.target.value.toUpperCase() }))
                      }
                    />
                  </div>
                </div>
              </fieldset>

              {erroFormulario && (
                <div role="alert" className={CLASSE_ERRO}>
                  {erroFormulario}
                </div>
              )}
            </div>

            <div className="mt-6 flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={fecharModal}>
                Cancelar
              </Button>
              <Button type="submit" disabled={salvando}>
                {salvando ? 'Salvando...' : licitacaoEditando ? 'Salvar alterações' : 'Cadastrar licitação'}
              </Button>
            </div>
          </form>
        </div>
      )}

      {licitacaoEstacoes && (
        <PainelEstacoes
          licitacao={licitacaoEstacoes}
          onFechar={() => setLicitacaoEstacoes(null)}
          onVinculadas={atualizarLista}
        />
      )}

      {confirmacaoStatus && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center bg-black/60 p-3 sm:p-4">
          <div
            className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl bg-card p-4 shadow-xl sm:p-6"
            role="alertdialog"
            aria-modal="true"
            aria-labelledby="titulo-confirmacao-status"
            aria-describedby="descricao-confirmacao-status"
            onKeyDown={(evento) => tratarTecladoNoDialogo(evento, voltarDaConfirmacao)}
          >
            <h2 id="titulo-confirmacao-status" className="text-lg font-semibold">
              {confirmacaoStatus.tipo === 'encerrar' ? 'Encerrar licitação?' : 'Confirmar mudança de status?'}
            </h2>
            {confirmacaoStatus.tipo === 'encerrar' ? (
              <div id="descricao-confirmacao-status" className="mt-2 space-y-2 text-sm text-muted-foreground">
                <p>
                  A licitação <strong>{confirmacaoStatus.licitacao.codigoIdentificador}</strong> será encerrada e não
                  poderá mais ser alterada nem receber estações, sensores ou usuários.
                </p>
                <ul className="list-disc space-y-1 pl-5">
                  <li>
                    {plural(confirmacaoStatus.licitacao.quantidadeEstacoes ?? 0, 'estação fica inativa', 'estações ficam inativas')}{' '}
                    e os alertas da licitação param de disparar;
                  </li>
                  <li>
                    {plural(confirmacaoStatus.licitacao.quantidadeUsuarios ?? 0, 'usuário continua', 'usuários continuam')}{' '}
                    entrando, mas só para ler;
                  </li>
                  <li>alarmes e medidas continuam como histórico.</li>
                </ul>
                <p>Essa ação não pode ser desfeita.</p>
              </div>
            ) : (
              <p id="descricao-confirmacao-status" className="mt-2 text-sm text-muted-foreground">
                A licitação <strong>{confirmacaoStatus.dados.codigoIdentificador}</strong>
                {confirmacaoStatus.licitacao ? ' terá o status alterado para ' : ' será cadastrada com o status '}
                <strong>{ROTULO_STATUS_LICITACAO[confirmacaoStatus.dados.status]}</strong>. Deseja continuar?
              </p>
            )}
            {erroConfirmacao && (
              <div role="alert" className={`mt-4 ${CLASSE_ERRO}`}>
                {erroConfirmacao}
              </div>
            )}
            <div className="mt-6 flex flex-wrap justify-end gap-3">
              <Button type="button" variant="outline" disabled={salvando} onClick={voltarDaConfirmacao}>
                Voltar
              </Button>
              <Button type="button" autoFocus disabled={salvando} onClick={() => void confirmarMudancaStatus()}>
                {salvando ? 'Salvando...' : confirmacaoStatus.tipo === 'encerrar' ? 'Encerrar licitação' : 'Confirmar'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

/**
 * Estações da licitação e transferência de estações de outras licitações para
 * ela. Toda estação tem licitação, então vincular é sempre transferir.
 */
function PainelEstacoes({
  licitacao,
  onFechar,
  onVinculadas,
}: {
  licitacao: LicitacaoApi;
  onFechar: () => void;
  onVinculadas: () => void;
}) {
  const [estacoes, setEstacoes] = useState<EstacaoApi[] | null>(null);
  const [erroEstacoes, setErroEstacoes] = useState<string | null>(null);
  const [versao, setVersao] = useState(0);
  const [busca, setBusca] = useState('');
  const [candidatas, setCandidatas] = useState<EstacaoApi[] | null>(null);
  const [erroCandidatas, setErroCandidatas] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [vinculando, setVinculando] = useState(false);
  const [erroVinculo, setErroVinculo] = useState<string | null>(null);
  const [resultado, setResultado] = useState<ResultadoVinculo | null>(null);

  const aceitaEstacoes = licitacao.status !== 'ENCERRADA';

  useEffect(() => {
    let ativo = true;
    api<EstacaoApi[]>(`/licitacoes/${licitacao.id}/estacoes`)
      .then((resposta) => {
        if (!ativo) return;
        setEstacoes(resposta);
        setErroEstacoes(null);
      })
      .catch((erro: unknown) => {
        if (ativo) setErroEstacoes(mensagemErro(erro, 'Não foi possível carregar as estações.'));
      });
    return () => {
      ativo = false;
    };
  }, [licitacao.id, versao]);

  useEffect(() => {
    if (!aceitaEstacoes) return;
    let ativo = true;
    const parametros = new URLSearchParams({ busca: busca.trim(), tamanho: '50' });
    api<Paginado<EstacaoApi>>(`/estacoes?${parametros.toString()}`)
      .then((resposta) => {
        if (!ativo) return;
        setCandidatas(resposta.itens.filter((estacao) => estacao.licitacao.id !== licitacao.id));
        setErroCandidatas(null);
      })
      .catch((erro: unknown) => {
        if (ativo) setErroCandidatas(mensagemErro(erro, 'Não foi possível buscar as estações.'));
      });
    return () => {
      ativo = false;
    };
  }, [aceitaEstacoes, busca, licitacao.id, versao]);

  function alternar(id: string) {
    setSelecionadas((atual) => (atual.includes(id) ? atual.filter((item) => item !== id) : [...atual, id]));
  }

  function fechar() {
    if (!vinculando) onFechar();
  }

  async function vincular() {
    if (selecionadas.length === 0) return;
    setVinculando(true);
    setErroVinculo(null);
    setResultado(null);
    try {
      const resposta = await api<ResultadoVinculo>(`/licitacoes/${licitacao.id}/estacoes`, {
        method: 'POST',
        body: JSON.stringify({ estacaoIds: selecionadas }),
      });
      setResultado(resposta);
      setSelecionadas([]);
      setVersao((atual) => atual + 1);
      onVinculadas();
    } catch (erro: unknown) {
      // O 400 por falta de tipo de sensor no destino já lista os que faltam.
      setErroVinculo(mensagemErro(erro, 'Não foi possível vincular as estações.'));
    } finally {
      setVinculando(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-3 sm:p-4">
      <div
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-card p-4 shadow-xl sm:p-6"
        role="dialog"
        aria-modal="true"
        aria-labelledby="titulo-estacoes-licitacao"
        onKeyDown={(evento) => tratarTecladoNoDialogo(evento, fechar)}
      >
        <div className="mb-5 flex items-start justify-between gap-4">
          <div className="min-w-0">
            <h2 id="titulo-estacoes-licitacao" className="text-xl font-semibold">
              Estações de {licitacao.codigoIdentificador}
            </h2>
            <p className="text-sm text-muted-foreground">{licitacao.orgaoNome}</p>
          </div>
          <button
            type="button"
            onClick={fechar}
            className="rounded-md p-2 hover:bg-muted"
            aria-label="Fechar estações"
            autoFocus
          >
            <X className="size-5" />
          </button>
        </div>

        <section aria-labelledby="titulo-estacoes-vinculadas" className="space-y-2">
          <h3 id="titulo-estacoes-vinculadas" className="font-mono text-[10px] uppercase text-muted-foreground">
            Vinculadas
          </h3>
          {erroEstacoes ? (
            <div role="alert" className={CLASSE_ERRO}>{erroEstacoes}</div>
          ) : estacoes === null ? (
            <p className="text-sm text-muted-foreground">Carregando estações...</p>
          ) : estacoes.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhuma estação vinculada.</p>
          ) : (
            <ul className="divide-y divide-border rounded-md border border-border" aria-label="Estações vinculadas">
              {estacoes.map((estacao) => (
                <li key={estacao.id} className="flex flex-wrap items-start justify-between gap-2 px-3 py-2 text-sm">
                  <div className="min-w-0">
                    <p className="font-medium">{estacao.nome}</p>
                    <p className="break-words text-xs text-muted-foreground">
                      <span className="font-mono">{estacao.vid}</span>
                      {estacao.sensores.length > 0 && ` · ${estacao.sensores.map((sensor) => sensor.nome).join(', ')}`}
                    </p>
                  </div>
                  <span className="whitespace-nowrap text-xs text-muted-foreground">
                    {estacao.statusOperacional === 'ATIVA' ? 'Ativa' : 'Inativa'}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {aceitaEstacoes ? (
          <section aria-labelledby="titulo-vincular-estacoes" className="mt-6 space-y-3">
            <h3 id="titulo-vincular-estacoes" className="font-mono text-[10px] uppercase text-muted-foreground">
              Vincular estações de outras licitações
            </h3>
            <div role="note" className="rounded-md border border-warning/30 bg-warning/10 px-3 py-2 text-xs text-foreground">
              A estação sai da licitação de origem: os alertas dela na origem são inativados e as medidas já gravadas
              continuam com a origem. Os sensores da estação precisam estar cadastrados, com o mesmo nome, em{' '}
              {licitacao.codigoIdentificador}.
            </div>
            <div className="flex flex-col gap-1">
              <label htmlFor="buscaEstacaoVinculo" className="text-sm font-medium">Buscar estação</label>
              <Input
                id="buscaEstacaoVinculo"
                type="search"
                placeholder="Nome ou vid..."
                value={busca}
                onChange={(evento) => setBusca(evento.target.value)}
              />
            </div>

            {erroCandidatas ? (
              <div role="alert" className={CLASSE_ERRO}>{erroCandidatas}</div>
            ) : candidatas === null ? (
              <p className="text-sm text-muted-foreground">Buscando estações...</p>
            ) : candidatas.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nenhuma estação de outra licitação encontrada.</p>
            ) : (
              <ul className="max-h-64 divide-y divide-border overflow-y-auto rounded-md border border-border" aria-label="Estações para vincular">
                {candidatas.map((estacao) => (
                  <li key={estacao.id}>
                    <label className="flex cursor-pointer items-start gap-3 px-3 py-2 text-sm hover:bg-muted/40">
                      <input
                        type="checkbox"
                        className="mt-1 size-4 shrink-0"
                        checked={selecionadas.includes(estacao.id)}
                        onChange={() => alternar(estacao.id)}
                      />
                      <span className="min-w-0">
                        <span className="block font-medium">{estacao.nome}</span>
                        <span className="block break-words text-xs text-muted-foreground">
                          <span className="font-mono">{estacao.vid}</span> · vem de{' '}
                          <strong className="font-mono">{estacao.licitacao.codigoIdentificador}</strong>
                          {estacao.sensores.length > 0 && ` · ${estacao.sensores.map((sensor) => sensor.nome).join(', ')}`}
                        </span>
                      </span>
                    </label>
                  </li>
                ))}
              </ul>
            )}

            {erroVinculo && <div role="alert" className={CLASSE_ERRO}>{erroVinculo}</div>}
            {resultado && (
              <div role="status" className="rounded-md border border-lime/30 bg-lime/10 px-3 py-2 text-sm">
                {plural(resultado.estacoesVinculadas, 'estação vinculada', 'estações vinculadas')};{' '}
                {plural(resultado.alertasInativados, 'alerta da origem inativado', 'alertas da origem inativados')}.
              </div>
            )}

            <div className="flex flex-wrap justify-end gap-2">
              <Button type="button" variant="outline" onClick={fechar} disabled={vinculando}>
                Fechar
              </Button>
              <Button type="button" onClick={() => void vincular()} disabled={vinculando || selecionadas.length === 0}>
                {vinculando
                  ? 'Vinculando...'
                  : selecionadas.length > 0
                    ? `Vincular ${plural(selecionadas.length, 'estação', 'estações')}`
                    : 'Vincular estações'}
              </Button>
            </div>
          </section>
        ) : (
          <p className="mt-6 text-sm text-muted-foreground">
            Licitação encerrada não recebe estações novas.
          </p>
        )}
      </div>
    </div>
  );
}
