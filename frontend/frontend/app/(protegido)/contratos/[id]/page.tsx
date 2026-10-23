'use client';

import { use, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  ArrowLeft,
  ChevronDown,
  ChevronRight,
  Link2,
  Unlink,
} from 'lucide-react';

import { PageHeading } from '@/components/PageHeading';
import { Button } from '@/components/ui/button';
import { api, ErroApi } from '@/lib/api';

type Sensor = {
  id: string;
  nome: string;
  unidade: string;
};

type Estacao = {
  id: string;
  nome: string;
  vid: string;
  endereco: string;
  statusOperacional: string;
  sensores: Sensor[];
};

type Contrato = {
  id: string;
  numero: string;
  orgao: string;
  cnpj: string;
  inicioVigencia: string;
  fimVigencia: string;
  status: string;
};

type EstacaoDisponivel = {
  id: string;
  nome: string;
  vid: string;
  contrato: {
    id: string;
    numero: string;
  } | null;
};

export default function ContratoDetalhePage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const router = useRouter();

  const [contrato, setContrato] = useState<Contrato | null>(null);
  const [estacoes, setEstacoes] = useState<Estacao[]>([]);
  const [estacoesDisponiveis, setEstacoesDisponiveis] = useState<
    EstacaoDisponivel[]
  >([]);

  const [estacaoAberta, setEstacaoAberta] = useState<string | null>(null);
  const [selecionadas, setSelecionadas] = useState<string[]>([]);

  const [carregando, setCarregando] = useState(true);
  const [carregandoDisponiveis, setCarregandoDisponiveis] = useState(false);
  const [salvando, setSalvando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregarDados = async () => {
    try {
      setCarregando(true);
      setErro(null);

      const [contratoResposta, estacoesResposta] = await Promise.all([
        api<Contrato>(`/contratos/${id}`),
        api<Estacao[]>(`/contratos/${id}/estacoes`),
      ]);

      setContrato(contratoResposta);
      setEstacoes(estacoesResposta);
    } catch (error) {
      setErro(
        error instanceof ErroApi
          ? error.message
          : 'Não foi possível carregar o contrato.',
      );
    } finally {
      setCarregando(false);
    }
  };

  const carregarEstacoesDisponiveis = async () => {
    try {
      setCarregandoDisponiveis(true);

      const resposta = await api<EstacaoDisponivel[]>('/estacoes');

      setEstacoesDisponiveis(
        resposta.filter((estacao) => estacao.contrato === null),
      );
    } catch (error) {
      setErro(
        error instanceof ErroApi
          ? error.message
          : 'Não foi possível carregar as estações disponíveis.',
      );
    } finally {
      setCarregandoDisponiveis(false);
    }
  };

  useEffect(() => {
    carregarDados();
    carregarEstacoesDisponiveis();
  }, [id]);

  const alternarEstacao = (estacaoId: string) => {
    setSelecionadas((atual) =>
      atual.includes(estacaoId)
        ? atual.filter((item) => item !== estacaoId)
        : [...atual, estacaoId],
    );
  };

  const vincularEstacoes = async () => {
    if (selecionadas.length === 0) {
      return;
    }

    try {
      setSalvando(true);
      setErro(null);

      await api(`/contratos/${id}/estacoes`, {
        method: 'POST',
        body: JSON.stringify({
          estacaoIds: selecionadas,
        }),
      });

      setSelecionadas([]);
      await carregarDados();
      await carregarEstacoesDisponiveis();
    } catch (error) {
      setErro(
        error instanceof ErroApi
          ? error.message
          : 'Não foi possível vincular as estações.',
      );
    } finally {
      setSalvando(false);
    }
  };

  const desvincularEstacao = async (estacaoId: string) => {
    const confirmar = window.confirm(
      'Tem certeza que deseja desvincular esta estação do contrato?',
    );

    if (!confirmar) {
      return;
    }

    try {
      setSalvando(true);
      setErro(null);

      await api(`/contratos/${id}/estacoes/${estacaoId}`, {
        method: 'DELETE',
      });

      await carregarDados();
      await carregarEstacoesDisponiveis();
    } catch (error) {
      setErro(
        error instanceof ErroApi
          ? error.message
          : 'Não foi possível desvincular a estação.',
      );
    } finally {
      setSalvando(false);
    }
  };

  if (carregando) {
    return (
      <div className="space-y-6">
        <PageHeading
          title="Detalhes do contrato"
          description="Estações e sensores vinculados ao contrato."
        />
        <div className="rounded-lg border p-6 text-sm text-muted-foreground">
          Carregando...
        </div>
      </div>
    );
  }

  if (!contrato) {
    return (
      <div className="space-y-6">
        <PageHeading
          title="Detalhes do contrato"
          description="Contrato não encontrado."
        />
        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Voltar
        </Button>
        {erro && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
            {erro}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <PageHeading
          title={`Contrato ${contrato.numero}`}
          description="Estações e sensores vinculados ao contrato."
        />

        <Button variant="outline" onClick={() => router.back()}>
          <ArrowLeft className="mr-2 size-4" />
          Voltar
        </Button>
      </div>

      {erro && (
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm text-destructive">
          {erro}
        </div>
      )}

      <section className="rounded-lg border bg-card p-6">
        <h2 className="mb-4 text-lg font-semibold">Dados do contrato</h2>

        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          <div>
            <p className="text-sm text-muted-foreground">Número</p>
            <p className="font-medium">{contrato.numero}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Órgão público</p>
            <p className="font-medium">{contrato.orgao}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">CNPJ</p>
            <p className="font-medium">{contrato.cnpj}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Status</p>
            <p className="font-medium">{contrato.status}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Início da vigência</p>
            <p className="font-medium">{contrato.inicioVigencia}</p>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">Fim da vigência</p>
            <p className="font-medium">{contrato.fimVigencia}</p>
          </div>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4 flex items-center justify-between gap-4">
          <div>
            <h2 className="text-lg font-semibold">Estações vinculadas</h2>
            <p className="text-sm text-muted-foreground">
              {estacoes.length} estação(ões) vinculada(s) a este contrato.
            </p>
          </div>
        </div>

        {estacoes.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Nenhuma estação vinculada a este contrato.
          </div>
        ) : (
          <div className="space-y-3">
            {estacoes.map((estacao) => {
              const aberta = estacaoAberta === estacao.id;

              return (
                <div key={estacao.id} className="rounded-lg border">
                  <div className="flex items-center justify-between gap-4 p-4">
                    <button
                      type="button"
                      className="flex min-w-0 flex-1 items-center gap-3 text-left"
                      onClick={() =>
                        setEstacaoAberta(aberta ? null : estacao.id)
                      }
                    >
                      {aberta ? (
                        <ChevronDown className="size-4 shrink-0" />
                      ) : (
                        <ChevronRight className="size-4 shrink-0" />
                      )}

                      <div className="min-w-0">
                        <p className="font-medium">{estacao.nome}</p>
                        <p className="text-sm text-muted-foreground">
                          {estacao.vid} · {estacao.endereco}
                        </p>
                      </div>
                    </button>

                    <Button
                      variant="outline"
                      size="sm"
                      disabled={salvando}
                      onClick={() => desvincularEstacao(estacao.id)}
                    >
                      <Unlink className="mr-2 size-4" />
                      Desvincular
                    </Button>
                  </div>

                  {aberta && (
                    <div className="border-t px-4 py-4">
                      {estacao.sensores.length === 0 ? (
                        <p className="text-sm text-muted-foreground">
                          Nenhum sensor vinculado a esta estação.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {estacao.sensores.map((sensor) => (
                            <div
                              key={sensor.id}
                              className="flex items-center justify-between rounded-md bg-muted/40 px-3 py-2"
                            >
                              <span className="text-sm">{sensor.nome}</span>
                              <span className="text-sm text-muted-foreground">
                                {sensor.unidade}
                              </span>
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

      <section className="rounded-lg border bg-card p-6">
        <div className="mb-4">
          <h2 className="text-lg font-semibold">Vincular estações</h2>
          <p className="text-sm text-muted-foreground">
            Selecione as estações que ainda não possuem contrato.
          </p>
        </div>

        {carregandoDisponiveis ? (
          <p className="text-sm text-muted-foreground">Carregando estações...</p>
        ) : estacoesDisponiveis.length === 0 ? (
          <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
            Não há estações disponíveis para vinculação.
          </div>
        ) : (
          <>
            <div className="space-y-2">
              {estacoesDisponiveis.map((estacao) => (
                <label
                  key={estacao.id}
                  className="flex cursor-pointer items-center gap-3 rounded-md border p-3 hover:bg-muted/40"
                >
                  <input
                    type="checkbox"
                    checked={selecionadas.includes(estacao.id)}
                    onChange={() => alternarEstacao(estacao.id)}
                  />

                  <div>
                    <p className="font-medium">{estacao.nome}</p>
                    <p className="text-sm text-muted-foreground">
                      {estacao.vid}
                    </p>
                  </div>
                </label>
              ))}
            </div>

            <div className="mt-4 flex justify-end">
              <Button
                disabled={selecionadas.length === 0 || salvando}
                onClick={vincularEstacoes}
              >
                <Link2 className="mr-2 size-4" />
                {salvando ? 'Vinculando...' : 'Vincular selecionadas'}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
