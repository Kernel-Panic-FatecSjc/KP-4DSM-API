'use client';

import { use, useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ArrowLeft, ChevronDown, ChevronRight, Link2 } from 'lucide-react';

import { PageHeading } from '@/components/PageHeading';
import { useUsuario } from '@/components/ProtectedLayout';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { api, ErroApi, type EstacaoApi, type LicitacaoApi, type Paginado } from '@/lib/api';
import { formatarCnpj } from '@/lib/cnpj';
import { ROTULOS_ESFERA, ROTULOS_MODALIDADE } from '@/lib/licitacoes';
import { ehTecsus, ROTULO_STATUS_LICITACAO, somenteLeitura } from '@/lib/perfil';

// Detalhe do contrato do PR #76, no modelo por licitação: o contrato e o órgão
// são campos da licitação, e a hierarquia licitação → estações → sensores vem
// de GET /licitacoes/:id/estacoes. Não há "desvincular": toda estação tem
// licitação, então tirar uma estação daqui é vinculá-la a outra licitação.

interface ResultadoVinculo {
  licitacaoId: string;
  estacoesVinculadas: number;
  alertasInativados: number;
}

function formatarData(data: string): string {
  return new Intl.DateTimeFormat('pt-BR', { timeZone: 'UTC' }).format(new Date(data));
}

function mensagemErro(erro: unknown, padrao: string): string {
  return erro instanceof ErroApi ? erro.message : padrao;
}

export default function LicitacaoDetalhePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params);
  const router = useRouter();
  const usuario = useUsuario();
  // Vincular é transferir estação entre licitações: só a Tecsus.
  const podeVincular = ehTecsus(usuario) && !somenteLeitura(usuario);

  const [licitacao, setLicitacao] = useState<LicitacaoApi | null>(null);
  const [estacoes, setEstacoes] = useState<EstacaoApi[]>([]);
  const [disponiveis, setDisponiveis] = useState<EstacaoApi[]>([]);
  const [busca, setBusca] = useState('');
  const [estacaoAberta, setEstacaoAberta] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    const [dados, daLicitacao] = await Promise.all([
      api<LicitacaoApi>(`/licitacoes/${id}`),
      api<EstacaoApi[]>(`/licitacoes/${id}/estacoes`),
    ]);
    setLicitacao(dados);
    setEstacoes(daLicitacao);
  }, [id]);

  useEffect(() => {
    let ativo = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- carrega a licitação ao abrir a página
    carregar()
      .catch((erroCapturado) => {
        if (ativo) setErro(mensagemErro(erroCapturado, 'Não foi possível carregar a licitação.'));
      })
      .finally(() => {
        if (ativo) setCarregando(false);
      });
    return () => {
      ativo = false;
    };
  }, [carregar]);

  const encerrada = licitacao?.status === 'ENCERRADA';

  useEffect(() => {
    if (!podeVincular || !licitacao || encerrada) return;
    let ativo = true;
    // Espera a digitação parar antes de consultar.
    const temporizador = setTimeout(() => {
      setCarregandoDisponiveis(true);
      const parametros = new URLSearchParams({ tamanho: '50' });
      if (busca.trim()) parametros.set('busca', busca.trim());
      api<Paginado<EstacaoApi>>(`/estacoes?${parametros}`)
        .then((resposta) => {
          if (ativo) setDisponiveis(resposta.itens.filter((estacao) => estacao.licitacao.id !== id));
        })
        .catch(() => {
          if (ativo) setDisponiveis([]);
        })
        .finally(() => {
          if (ativo) setCarregandoDisponiveis(false);
        });
    }, 300);
    return () => {
      ativo = false;
      clearTimeout(temporizador);
    };
  }, [podeVincular, licitacao, encerrada, busca, id]);

  const alternarEstacao = (estacaoId: string) => {
    setSelecionadas((atual) =>
      atual.includes(estacaoId) ? atual.filter((item) => item !== estacaoId) : [...atual, estacaoId],
    );
  };

  const vincularEstacoes = async () => {
    if (selecionadas.length === 0 || !podeVincular || encerrada) return;

    try {
      setSalvando(true);
      setErro(null);
      setAviso(null);
      const resultado = await api<ResultadoVinculo>(`/licitacoes/${id}/estacoes`, {
        method: 'POST',
        body: JSON.stringify({ estacaoIds: selecionadas }),
      });
      setSelecionadas([]);
      setAviso(
        `${resultado.estacoesVinculadas} estação(ões) vinculada(s); ${resultado.alertasInativados} alerta(s) da origem inativado(s).`,
      );
      setBusca('');
      await carregar();
    } catch (erroCapturado) {
      setErro(mensagemErro(erroCapturado, 'Não foi possível vincular as estações.'));
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="space-y-6">
        <PageHeading title="Detalhes da licitação" description="Contrato, órgão, estações e sensores da licitação." />
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">Carregando...</div>
      </div>
    );
  }

  if (!licitacao) {
    return (
      <div className="space-y-6">
        <PageHeading title="Detalhes da licitação" description="Licitação não encontrada." />
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Voltar
        </Button>
        {erro && (
          <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {erro}
          </div>
        )}
      </div>
    );
  }

  const campos: [string, string][] = [
    ['Código', licitacao.codigoIdentificador],
    ['Processo', `${licitacao.numeroProcesso} · ${ROTULOS_MODALIDADE[licitacao.modalidade]}`],
    ['Contrato', licitacao.numeroContrato],
    ['Status', ROTULO_STATUS_LICITACAO[licitacao.status]],
    ['Início da vigência', formatarData(licitacao.inicioVigencia)],
    ['Fim da vigência', formatarData(licitacao.fimVigencia)],
    ['Órgão público', licitacao.orgaoNome],
    ['CNPJ', licitacao.orgaoCnpj ? formatarCnpj(licitacao.orgaoCnpj) : 'Não informado'],
    ['Esfera', ROTULOS_ESFERA[licitacao.orgaoEsfera]],
    ['Município', `${licitacao.orgaoMunicipio}/${licitacao.orgaoUf}`],
  ];
  if (licitacao.encerradaEm) campos.push(['Encerrada em', formatarData(licitacao.encerradaEm)]);

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeading title={`Licitação ${licitacao.codigoIdentificador}`} description={licitacao.objeto} />
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Voltar
        </Button>
      </div>

      {erro && (
        <div role="alert" className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}
      {aviso && (
        <div role="status" className="rounded-lg border border-lime/30 bg-lime/10 p-4 text-sm">
          {aviso}
        </div>
      )}

      <section className="rounded-lg border bg-card p-4 sm:p-6">
        <h2 className="mb-4 text-lg font-semibold">Contrato e órgão</h2>
        <dl className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {campos.map(([rotulo, valor]) => (
            <div key={rotulo} className="min-w-0">
              <dt className="text-sm text-muted-foreground">{rotulo}</dt>
              <dd className="break-words font-medium">{valor}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="rounded-lg border bg-card p-4 sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Estações da licitação</h2>
          <p className="text-sm text-muted-foreground">{estacoes.length} estação(ões) vinculada(s) a esta licitação.</p>
        </div>

        {estacoes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma estação vinculada a esta licitação.
          </div>
        ) : (
          <div className="space-y-3">
            {estacoes.map((estacao) => {
              const aberta = estacaoAberta === estacao.id;
              return (
                <div key={estacao.id} className="rounded-lg border">
                  <button
                    type="button"
                    aria-expanded={aberta}
                    className="flex w-full min-w-0 items-center gap-3 p-4 text-left"
                    onClick={() => setEstacaoAberta(aberta ? null : estacao.id)}
                  >
                    {aberta ? <ChevronDown className="size-4 shrink-0" /> : <ChevronRight className="size-4 shrink-0" />}
                    <div className="min-w-0 flex-1">
                      <p className="font-medium">{estacao.nome}</p>
                      <p className="break-all text-sm text-muted-foreground">
                        {estacao.vid} · {estacao.endereco}
                      </p>
                    </div>
                    <span className="shrink-0 text-xs text-muted-foreground">
                      {estacao.statusOperacional === 'ATIVA' ? 'Ativa' : 'Inativa'} · {estacao.sensores.length} sensor(es)
                    </span>
                  </button>

                  {aberta && (
                    <div className="border-t px-4 py-4">
                      {estacao.sensores.length === 0 ? (
                        <p className="text-sm text-muted-foreground">Nenhum sensor vinculado a esta estação.</p>
                      ) : (
                        <div className="space-y-2">
                          {estacao.sensores.map((sensor) => (
                            <div key={sensor.id} className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2">
                              <span className="text-sm">{sensor.nome}</span>
                              <span className="text-sm text-muted-foreground">{sensor.unidade}</span>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </section>

      {podeVincular && !encerrada && (
        <section className="rounded-lg border bg-card p-4 sm:p-6">
          <div className="mb-4">
            <h2 className="text-lg font-semibold">Vincular estações</h2>
            <p className="text-sm text-muted-foreground">
              A estação sai da licitação atual. Os sensores passam a usar os tipos de mesmo nome desta licitação (que
              precisam existir aqui), os alertas da origem são inativados e as medidas já gravadas continuam com a origem.
            </p>
          </div>

          <Input
            aria-label="Buscar estação"
            placeholder="Buscar por nome ou UUID/MAC..."
            value={busca}
            onChange={(evento) => setBusca(evento.target.value)}
            className="mb-3"
          />

          {carregandoDisponiveis ? (
            <p className="text-sm text-muted-foreground">Carregando estações...</p>
          ) : disponiveis.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              Nenhuma estação de outra licitação encontrada.
            </div>
          ) : (
            <>
              <div className="space-y-2">
                {disponiveis.map((estacao) => (
                  <label key={estacao.id} className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/40">
                    <input type="checkbox" checked={selecionadas.includes(estacao.id)} onChange={() => alternarEstacao(estacao.id)} />
                    <div className="min-w-0">
                      <p className="font-medium">{estacao.nome}</p>
                      <p className="break-all text-sm text-muted-foreground">
                        {estacao.vid} · vem de <strong className="font-mono">{estacao.licitacao.codigoIdentificador}</strong>
                      </p>
                    </div>
                  </label>
                ))}
              </div>

              <div className="mt-4 flex justify-end">
                <Button disabled={selecionadas.length === 0 || salvando} onClick={vincularEstacoes}>
                  <Link2 className="mr-2 size-4" />
                  {salvando ? 'Vinculando...' : 'Vincular selecionadas'}
                </Button>
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}
