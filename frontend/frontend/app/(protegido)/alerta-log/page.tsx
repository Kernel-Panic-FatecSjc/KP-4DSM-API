"use client";

import React, { useState, useMemo, useEffect } from "react";
import { api, ErroApi } from "@/lib/api";
import { PageHeading } from "@/components/PageHeading";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import {
  Search,
  MapPin,
  Clock,
  Activity,
  Gauge,
  AlertTriangle,
  CheckCircle2,
  CircleDot,
  XCircle,
  User,
  FileText,
  Radio,
  Navigation,
  LucideIcon,
} from "lucide-react";

type Severidade = "baixa" | "media" | "alta" | "critica";
type Status = "aberta" | "em_analise" | "resolvida" | "falso_positivo";

interface EventoHistorico {
  hora: string;
  evento: string;
}

interface Ocorrencia {
  id: string;
  dataHora: string;
  estacao: string;
  parametro: string;
  unidade: string;
  valor: number;
  limiar: number;
  severidade: Severidade;
  status: Status;
  coordenadas: string;
  sensorId: string;
  duracao: string;
  responsavel: string;
  observacoes: string;
  historico: EventoHistorico[];
}

interface SeveridadeInfo {
  label: string;
  cor: string;
  fundo: string;
}

interface StatusInfo {
  label: string;
  cor: string;
  icon: LucideIcon;
}

const palette = {
  bg: "#F5F9FF",
  panel: "#FFFFFF",
  panelAlt: "#F2F7FD",
  border: "#DDEAF8",
  borderSoft: "#EDF4FB",
  textPrimary: "#15314C",
  textMuted: "#4E647D",
  textFaint: "#8193A8",
  accent: "#3AA0D9",
} as const;

const severidadeConfig: Record<Severidade, SeveridadeInfo> = {
  baixa: { label: "Baixa", cor: "#22C55E", fundo: "#ECFDF5" },
  media: { label: "Média", cor: "#F59E0B", fundo: "#FFF7E8" },
  alta: { label: "Alta", cor: "#F97316", fundo: "#FFF3E8" },
  critica: { label: "Crítica", cor: "#EF4444", fundo: "#FEECEC" },
};

const statusConfig: Record<Status, StatusInfo> = {
  aberta: { label: "Aberta", cor: "#EF4444", icon: AlertTriangle },
  em_analise: { label: "Em análise", cor: "#F59E0B", icon: CircleDot },
  resolvida: { label: "Resolvida", cor: "#22C55E", icon: CheckCircle2 },
  falso_positivo: { label: "Falso positivo", cor: "#7C8BA0", icon: XCircle },
};

const normalizarSeveridade = (valor?: string): Severidade => {
  const mapa: Record<string, Severidade> = {
    baixa: "baixa",
    media: "media",
    media_outra: "media",
    média: "media",
    alta: "alta",
    critica: "critica",
    crítica: "critica",
  };

  return mapa[String(valor ?? "").toLowerCase()] ?? "media";
};

const normalizarStatus = (valor?: string): Status => {
  const mapa: Record<string, Status> = {
    aberta: "aberta",
    em_analise: "em_analise",
    emanalise: "em_analise",
    "em análise": "em_analise",
    resolvida: "resolvida",
    falso_positivo: "falso_positivo",
    falso: "falso_positivo",
  };

  return mapa[String(valor ?? "").toLowerCase().replace(/\s+/g, "_")] ?? "aberta";
};

const normalizarOcorrencia = (
  item: Partial<Ocorrencia> & Record<string, unknown>,
  indice = 0,
): Ocorrencia => {
  const base = ocorrenciasBase[indice] ?? ocorrenciasBase[0];

  return {
    ...base,
    ...item,
    id: String(item.id ?? base.id),
    dataHora: String(item.dataHora ?? base.dataHora),
    estacao: String(item.estacao ?? base.estacao),
    parametro: String(item.parametro ?? base.parametro),
    unidade: String(item.unidade ?? base.unidade),
    valor: Number(item.valor ?? base.valor),
    limiar: Number(item.limiar ?? base.limiar),
    severidade: normalizarSeveridade(String(item.severidade ?? base.severidade)),
    status: normalizarStatus(String(item.status ?? base.status)),
    coordenadas: String(item.coordenadas ?? base.coordenadas),
    sensorId: String(item.sensorId ?? base.sensorId),
    duracao: String(item.duracao ?? base.duracao),
    responsavel: String(item.responsavel ?? base.responsavel),
    observacoes: String(item.observacoes ?? base.observacoes),
    historico: Array.isArray(item.historico)
      ? (item.historico as EventoHistorico[])
      : base.historico,
  };
};

const ocorrenciasBase: Ocorrencia[] = [
  {
    id: "OC-2026-0148",
    dataHora: "14/09/2026 06:12",
    estacao: "Estação Rio Paraíba — Ponte Nova",
    parametro: "Nível do rio",
    unidade: "m",
    valor: 4.8,
    limiar: 3.5,
    severidade: "critica",
    status: "aberta",
    coordenadas: "-23.1896, -45.8841",
    sensorId: "SNS-HDR-014",
    duracao: "1h 42min",
    responsavel: "Não atribuído",
    observacoes:
      "Nível subiu 1,3 m nas últimas 3 horas após chuva intensa na cabeceira. Comporta de contenção a jusante ainda não acionada.",
    historico: [
      { hora: "04:30", evento: "Leitura acima do normal registrada" },
      { hora: "05:15", evento: "Alerta automático gerado" },
      { hora: "06:12", evento: "Limiar crítico ultrapassado" },
    ],
  },
  {
    id: "OC-2026-0147",
    dataHora: "13/09/2026 22:47",
    estacao: "Estação Serra do Mar — Encosta 3",
    parametro: "Umidade do solo",
    unidade: "%",
    valor: 92,
    limiar: 85,
    severidade: "alta",
    status: "em_analise",
    coordenadas: "-23.4531, -45.9502",
    sensorId: "SNS-SOL-027",
    duracao: "9h 05min",
    responsavel: "Marcos Vieira — Equipe de campo",
    observacoes:
      "Saturação do solo elevada por 3 dias consecutivos de chuva. Equipe de campo enviada para inspeção visual da encosta.",
    historico: [
      { hora: "18:00", evento: "Umidade em elevação constante" },
      { hora: "22:47", evento: "Limiar de alerta ultrapassado" },
      { hora: "23:30", evento: "Equipe de campo acionada" },
    ],
  },
  {
    id: "OC-2026-0146",
    dataHora: "13/09/2026 15:03",
    estacao: "Estação Vale do Una — Bairro Industrial",
    parametro: "Índice pluviométrico",
    unidade: "mm/h",
    valor: 38,
    limiar: 40,
    severidade: "media",
    status: "resolvida",
    coordenadas: "-23.2237, -45.9009",
    sensorId: "SNS-PLU-009",
    duracao: "2h 20min",
    responsavel: "Camila Duarte — Monitoramento",
    observacoes:
      "Intensidade de chuva reduziu naturalmente após frente fria se deslocar para o litoral. Nenhuma ação de campo necessária.",
    historico: [
      { hora: "14:40", evento: "Índice se aproximando do limiar" },
      { hora: "15:03", evento: "Alerta de atenção gerado" },
      { hora: "17:23", evento: "Índice normalizado, ocorrência encerrada" },
    ],
  },
  {
    id: "OC-2026-0145",
    dataHora: "12/09/2026 09:18",
    estacao: "Estação Serra do Mar — Encosta 1",
    parametro: "Inclinação do terreno",
    unidade: "°",
    valor: 1.2,
    limiar: 2.0,
    severidade: "baixa",
    status: "falso_positivo",
    coordenadas: "-23.4489, -45.9438",
    sensorId: "SNS-INC-003",
    duracao: "38min",
    responsavel: "Rafael Nunes — Manutenção",
    observacoes:
      "Variação registrada pelo inclinômetro foi causada por instabilidade elétrica no sensor. Manutenção corretiva agendada.",
    historico: [
      { hora: "09:18", evento: "Variação abrupta detectada" },
      { hora: "09:56", evento: "Sensor identificado como instável" },
      { hora: "10:10", evento: "Classificada como falso positivo" },
    ],
  },
  {
    id: "OC-2026-0144",
    dataHora: "11/09/2026 20:55",
    estacao: "Estação Rio Paraíba — Jusante Sul",
    parametro: "Nível do rio",
    unidade: "m",
    valor: 3.1,
    limiar: 3.0,
    severidade: "media",
    status: "em_analise",
    coordenadas: "-23.2012, -45.8790",
    sensorId: "SNS-HDR-008",
    duracao: "14h 30min",
    responsavel: "Marcos Vieira — Equipe de campo",
    observacoes:
      "Nível estabilizado logo acima do limiar. Monitoramento contínuo mantido devido a previsão de nova chuva à noite.",
    historico: [
      { hora: "20:10", evento: "Nível se aproximando do limiar" },
      { hora: "20:55", evento: "Limiar ultrapassado" },
    ],
  },
];

function formatNumero(valor: number): string {
  return Number.isInteger(valor) ? String(valor) : valor.toFixed(1).replace(".", ",");
}

interface BarraProps {
  valor: number;
  limiar: number;
  cor: string;
}

function Barra({ valor, limiar, cor }: BarraProps) {
  const proporcao = Math.min((valor / limiar) * 100, 160);
  const larguraValor = Math.min(proporcao, 100);

  return (
    <div className="mt-3.5">
      <div className="relative h-2.5 overflow-visible rounded border border-border bg-muted">
        <div
          className="absolute left-0 top-0 bottom-0 rounded transition-all duration-300"
          style={{
            width: `${larguraValor}%`,
            background: cor,
          }}
        />
        <div
          className="absolute top-[-4px] bottom-[-4px] w-0.5 bg-foreground/60"
          style={{
            left: `${Math.min((limiar / limiar) * (100 / 1.6), 62.5)}%`,
          }}
        />
      </div>
      <div className="mt-1.5 flex justify-between text-xs text-muted-foreground">
        <span>0</span>
        <span>Limiar configurado à direita da marca</span>
      </div>
    </div>
  );
}

interface InfoLinhaProps {
  icon: LucideIcon;
  rotulo: string;
  valor: string;
  mono?: boolean;
}

function InfoLinha({ icon: Icon, rotulo, valor, mono }: InfoLinhaProps) {
  return (
    <div className="flex gap-2.5 border-b border-muted px-0 py-2.5">
      <Icon size={15} className="mt-0.5 flex-shrink-0 text-muted-foreground" />
      <div>
        <div className="text-xs text-muted-foreground">{rotulo}</div>
        <div className={cn("mt-0.5 text-sm text-foreground", mono && "font-mono")}>
          {valor}
        </div>
      </div>
    </div>
  );
}

export default function AlertaLogPage() {
  const [ocorrencias, setOcorrencias] = useState<Ocorrencia[]>(ocorrenciasBase);
  const [selecionadaId, setSelecionadaId] = useState<string>(ocorrenciasBase[0]?.id ?? "");
  const [busca, setBusca] = useState<string>("");
  const [carregando, setCarregando] = useState<boolean>(true);
  const [erroApi, setErroApi] = useState<string | null>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarOcorrencias() {
      try {
        setCarregando(true);
        const dadosApi = await api<Array<Partial<Ocorrencia> & Record<string, unknown>>>('/alertas');

        if (!ativo) return;

        if (Array.isArray(dadosApi) && dadosApi.length > 0) {
          const normalizadas = dadosApi.map((item, indice) => normalizarOcorrencia(item, indice));
          setOcorrencias(normalizadas);
          setSelecionadaId(normalizadas[0].id);
        } else {
          setOcorrencias(ocorrenciasBase);
          setSelecionadaId(ocorrenciasBase[0]?.id ?? "");
        }

        setErroApi(null);
      } catch (erro) {
        if (!ativo) return;

        console.warn('Falha ao carregar ocorrências da API, usando dados locais.', erro);
        setOcorrencias(ocorrenciasBase);
        setSelecionadaId(ocorrenciasBase[0]?.id ?? "");
        setErroApi(erro instanceof ErroApi ? erro.message : 'Mostrando dados de exemplo');
      } finally {
        if (ativo) setCarregando(false);
      }
    }

    carregarOcorrencias();

    return () => {
      ativo = false;
    };
  }, []);

  const listaFiltrada: Ocorrencia[] = useMemo(() => {
    const termo = busca.trim().toLowerCase();
    if (!termo) return ocorrencias;
    return ocorrencias.filter(
      (o) =>
        o.estacao.toLowerCase().includes(termo) ||
        o.parametro.toLowerCase().includes(termo) ||
        o.id.toLowerCase().includes(termo)
    );
  }, [busca, ocorrencias]);

  const ocorrencia: Ocorrencia =
    ocorrencias.find((o) => o.id === selecionadaId) ?? ocorrencias[0] ?? ocorrenciasBase[0];
  const sev = severidadeConfig[ocorrencia.severidade];
  const st = statusConfig[ocorrencia.status];
  const StatusIcon = st.icon;
  const excedeu = ocorrencia.valor >= ocorrencia.limiar;

  return (
    <div className="flex flex-1 flex-col">
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
          .font-mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
          .lista-item:hover { background: rgb(242, 247, 253); }
          .lista-item.ativo { background: rgb(242, 247, 253); }
          input.busca::placeholder { color: rgb(129, 147, 168); }
        `}</style>

        <div className="space-y-5 p-7">
          <PageHeading
            title="Detalhamento de ocorrência"
            description="Monitoramento de parâmetros hidrológicos e geotécnicos — SIGVIA"
          />

          {erroApi && (
            <p className="text-xs text-muted-foreground">
              {erroApi}
            </p>
          )}

          <div
            className="grid gap-5 lg:grid-cols-[340px_1fr] sigvia-grid"
          >
            <div className="rise delay-0 flex flex-col overflow-hidden rounded-lg border border-border bg-card">
              <div className="border-b border-border p-3.5">
                <div className="flex items-center gap-2 rounded border border-border bg-muted px-2.5 py-2">
                  <Search size={15} className="text-muted-foreground" />
                  <input
                    className="busca w-full bg-transparent text-sm outline-none"
                    value={busca}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusca(e.target.value)}
                    placeholder="Buscar estação, parâmetro ou ID"
                  />
                </div>
              </div>

              <div className="overflow-y-auto">
                {carregando && (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    Carregando ocorrências...
                  </div>
                )}

                {!carregando &&
                  listaFiltrada.map((o) => {
                    const s = severidadeConfig[o.severidade];
                    const ativo = o.id === selecionadaId;
                    return (
                      <button
                        key={o.id}
                        onClick={() => setSelecionadaId(o.id)}
                        className={`lista-item w-full border-b border-muted text-left transition-colors hover:bg-muted last:border-b-0 ${
                          ativo ? "ativo bg-muted" : ""
                        }`}
                      >
                        <div className="flex">
                          <div className="w-1 flex-shrink-0" style={{ background: s.cor }} />
                          <div className="flex-1 px-3.5 py-3">
                            <div className="flex justify-between gap-2">
                              <span className="truncate text-sm font-medium text-foreground">
                                {o.estacao}
                              </span>
                            </div>
                            <div className="mt-0.5 text-xs text-muted-foreground">
                              {o.parametro}
                            </div>
                            <div className="mt-2 flex justify-between">
                              <span className="font-mono text-xs text-muted-foreground">
                                {o.dataHora}
                              </span>
                              <span
                                className="flex items-center gap-1 text-xs"
                                style={{
                                  color: statusConfig[o.status].cor,
                                }}
                              >
                                <span
                                  className="size-1.5 rounded-full"
                                  style={{
                                    background: statusConfig[o.status].cor,
                                  }}
                                />
                                {statusConfig[o.status].label}
                              </span>
                            </div>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                {listaFiltrada.length === 0 && (
                  <div className="p-5 text-center text-sm text-muted-foreground">
                    Nenhuma ocorrência encontrada para esta busca.
                  </div>
                )}
              </div>
            </div>

            <div className="rise delay-1 rounded-lg border border-border bg-card p-6 space-y-6">
              <div className="flex flex-wrap justify-between gap-3">
                <div>
                  <div className="font-mono text-xs text-muted-foreground mb-1.5">
                    {ocorrencia.id}
                  </div>
                  <h2 className="text-xl font-semibold">
                    {ocorrencia.estacao}
                  </h2>
                  <div className="mt-1.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    <Clock size={14} />
                    <span className="font-mono">{ocorrencia.dataHora}</span>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <span
                    className="inline-flex items-center gap-1.5 rounded px-3 py-1.5 text-xs font-medium"
                    style={{
                      background: sev.fundo,
                      color: sev.cor,
                    }}
                  >
                    <AlertTriangle size={14} />
                    Severidade {sev.label}
                  </span>
                  <span
                    className="inline-flex items-center gap-1.5 rounded border border-border bg-muted px-3 py-1.5 text-xs font-medium"
                    style={{
                      color: st.cor,
                    }}
                  >
                    <StatusIcon size={14} />
                    {st.label}
                  </span>
                </div>
              </div>

              <div className="rounded-lg border border-border bg-muted p-4.5">
                <div className="mb-1 flex items-center gap-2">
                  <Gauge size={15} className="text-aqua" />
                  <span className="text-xs text-muted-foreground">
                    Parâmetro monitorado
                  </span>
                </div>
                <div className="mb-3.5 text-base font-medium">
                  {ocorrencia.parametro}
                </div>

                <div className="flex flex-wrap gap-8">
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      Valor registrado
                    </div>
                    <div
                      className="font-mono text-2xl font-semibold"
                      style={{
                        color: excedeu ? sev.cor : "currentColor",
                      }}
                    >
                      {formatNumero(ocorrencia.valor)}
                      <span className="ml-1 text-sm text-muted-foreground">
                        {ocorrencia.unidade}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div className="mb-1 text-xs text-muted-foreground">
                      Limiar configurado
                    </div>
                    <div className="font-mono text-2xl font-semibold">
                      {formatNumero(ocorrencia.limiar)}
                      <span className="ml-1 text-sm text-muted-foreground">
                        {ocorrencia.unidade}
                      </span>
                    </div>
                  </div>
                </div>

                <Barra valor={ocorrencia.valor} limiar={ocorrencia.limiar} cor={sev.cor} />
              </div>

              <div
                className="grid gap-3.5 sigvia-info-grid sm:grid-cols-2"
              >
                <InfoLinha icon={MapPin} rotulo="Coordenadas" valor={ocorrencia.coordenadas} mono />
                <InfoLinha icon={Radio} rotulo="Sensor / equipamento" valor={ocorrencia.sensorId} mono />
                <InfoLinha icon={Activity} rotulo="Duração do evento" valor={ocorrencia.duracao} />
                <InfoLinha icon={User} rotulo="Responsável" valor={ocorrencia.responsavel} />
              </div>

              <div>
                <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                  <FileText size={15} />
                  Observações técnicas
                </div>
                <p className="rounded-lg border border-border bg-muted p-3.5 text-sm leading-relaxed">
                  {ocorrencia.observacoes}
                </p>
              </div>

              <div>
                <div className="mb-2.5 flex items-center gap-2 text-sm text-muted-foreground">
                  <Navigation size={15} />
                  Histórico do evento
                </div>
                <div className="border-l-2 border-border pl-4">
                  {ocorrencia.historico.map((h, i) => (
                    <div
                      key={i}
                      className="relative"
                      style={{
                        paddingBottom: i === ocorrencia.historico.length - 1 ? 0 : 16,
                      }}
                    >
                      <span
                        className="absolute left-[-17px] top-1 size-2 rounded-full bg-aqua"
                      />
                      <span className="font-mono text-xs text-muted-foreground">
                        {h.hora}
                      </span>
                      <div className="mt-0.5 text-sm">
                        {h.evento}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>

        <style>{`
          @media (max-width: 860px) {
            .sigvia-grid { grid-template-columns: 1fr !important; }
            .sigvia-info-grid { grid-template-columns: 1fr !important; }
          }
        `}</style>
    </div>
  );
}