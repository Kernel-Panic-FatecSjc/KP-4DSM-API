"use client";

import React, { useState, useMemo, useEffect } from "react";
import { api, ErroApi } from "@/lib/api";
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
    <div style={{ marginTop: 14 }}>
      <div
        style={{
          position: "relative",
          height: 10,
          borderRadius: 5,
          background: palette.panelAlt,
          border: `1px solid ${palette.border}`,
          overflow: "visible",
        }}
      >
        <div
          style={{
            position: "absolute",
            left: 0,
            top: 0,
            bottom: 0,
            width: `${larguraValor}%`,
            borderRadius: 5,
            background: cor,
            transition: "width 300ms ease",
          }}
        />
        <div
          style={{
            position: "absolute",
            left: `${Math.min((limiar / limiar) * (100 / 1.6), 62.5)}%`,
            top: -4,
            bottom: -4,
            width: 2,
            background: palette.textPrimary,
            opacity: 0.6,
          }}
        />
      </div>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          marginTop: 6,
          fontSize: 11,
          color: palette.textFaint,
        }}
      >
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
    <div
      style={{
        display: "flex",
        alignItems: "flex-start",
        gap: 10,
        padding: "10px 0",
        borderBottom: `1px solid ${palette.borderSoft}`,
      }}
    >
      <Icon size={15} color={palette.textFaint} style={{ marginTop: 2, flexShrink: 0 }} />
      <div>
        <div style={{ fontSize: 11.5, color: palette.textFaint }}>{rotulo}</div>
        <div
          className={mono ? "mono" : undefined}
          style={{ fontSize: 13.5, color: palette.textPrimary, marginTop: 2 }}
        >
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
    <div
      style={{
        flex: 1,
        fontFamily:
          "'IBM Plex Sans', ui-sans-serif, system-ui, -apple-system, sans-serif",
        background: palette.bg,
        color: palette.textPrimary,
        minHeight: "100vh",
        padding: "28px 20px",
      }}
    >
        <style>{`
          @import url('https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Mono:wght@400;500;600&display=swap');
          .mono { font-family: 'IBM Plex Mono', ui-monospace, monospace; }
          .lista-item:hover { background: ${palette.panelAlt}; }
          .lista-item.ativo { background: ${palette.panelAlt}; }
          input.busca::placeholder { color: ${palette.textFaint}; }
        `}</style>

        <div style={{ maxWidth: 1180, margin: "0 auto" }}>
          <div
            style={{
              marginBottom: 20,
              padding: "18px 20px",
              borderRadius: 16,
              background: "linear-gradient(135deg, rgba(58,160,217,0.12), rgba(255,255,255,0.95))",
              border: `1px solid ${palette.border}`,
              boxShadow: "0 10px 30px rgba(21, 49, 76, 0.04)",
            }}
          >
            <h1 style={{ fontSize: 22, fontWeight: 600, margin: 0, color: palette.textPrimary }}>
              Detalhamento de ocorrência
            </h1>
            <p style={{ fontSize: 13.5, color: palette.textMuted, margin: "6px 0 0" }}>
              Monitoramento de parâmetros hidrológicos e geotécnicos — SIGVIA
            </p>
            {erroApi && (
              <p style={{ fontSize: 12, color: palette.textMuted, margin: "10px 0 0" }}>
                {erroApi}
              </p>
            )}
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "340px 1fr",
              gap: 20,
            }}
            className="sigvia-grid"
          >
            <div
              style={{
                background: palette.panel,
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                overflow: "hidden",
                display: "flex",
                flexDirection: "column",
                maxHeight: 640,
              }}
            >
              <div style={{ padding: 14, borderBottom: `1px solid ${palette.border}` }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    background: palette.panelAlt,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 8,
                    padding: "8px 10px",
                  }}
                >
                  <Search size={15} color={palette.textFaint} />
                  <input
                    className="busca"
                    value={busca}
                    onChange={(e: React.ChangeEvent<HTMLInputElement>) => setBusca(e.target.value)}
                    placeholder="Buscar estação, parâmetro ou ID"
                    style={{
                      background: "transparent",
                      border: "none",
                      outline: "none",
                      color: palette.textPrimary,
                      fontSize: 13,
                      width: "100%",
                    }}
                  />
                </div>
              </div>

              <div style={{ overflowY: "auto" }}>
                {carregando && (
                  <div style={{ padding: 20, fontSize: 13, color: palette.textFaint }}>
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
                        className={`lista-item ${ativo ? "ativo" : ""}`}
                        style={{
                          display: "flex",
                          width: "100%",
                          textAlign: "left",
                          background: "transparent",
                          border: "none",
                          borderBottom: `1px solid ${palette.borderSoft}`,
                          cursor: "pointer",
                          padding: 0,
                        }}
                      >
                        <div style={{ width: 4, background: s.cor, flexShrink: 0 }} />
                        <div style={{ padding: "12px 14px", flex: 1, minWidth: 0 }}>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "baseline",
                              gap: 8,
                            }}
                          >
                            <span
                              style={{
                                fontSize: 13.5,
                                fontWeight: 500,
                                color: palette.textPrimary,
                                overflow: "hidden",
                                textOverflow: "ellipsis",
                                whiteSpace: "nowrap",
                              }}
                            >
                              {o.estacao}
                            </span>
                          </div>
                          <div style={{ fontSize: 12, color: palette.textMuted, marginTop: 2 }}>
                            {o.parametro}
                          </div>
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginTop: 8,
                            }}
                          >
                            <span className="mono" style={{ fontSize: 11.5, color: palette.textFaint }}>
                              {o.dataHora}
                            </span>
                            <span
                              style={{
                                fontSize: 11,
                                color: statusConfig[o.status].cor,
                                display: "flex",
                                alignItems: "center",
                                gap: 4,
                              }}
                            >
                              <span
                                style={{
                                  width: 6,
                                  height: 6,
                                  borderRadius: "50%",
                                  background: statusConfig[o.status].cor,
                                  display: "inline-block",
                                }}
                              />
                              {statusConfig[o.status].label}
                            </span>
                          </div>
                        </div>
                      </button>
                    );
                  })}

                {listaFiltrada.length === 0 && (
                  <div style={{ padding: 20, fontSize: 13, color: palette.textFaint }}>
                    Nenhuma ocorrência encontrada para esta busca.
                  </div>
                )}
              </div>
            </div>

            <div
              style={{
                background: palette.panel,
                border: `1px solid ${palette.border}`,
                borderRadius: 10,
                padding: 24,
              }}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "flex-start",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div>
                  <div
                    className="mono"
                    style={{ fontSize: 12, color: palette.textFaint, marginBottom: 6 }}
                  >
                    {ocorrencia.id}
                  </div>
                  <h2 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>
                    {ocorrencia.estacao}
                  </h2>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      marginTop: 6,
                      color: palette.textMuted,
                      fontSize: 13,
                    }}
                  >
                    <Clock size={14} />
                    <span className="mono">{ocorrencia.dataHora}</span>
                  </div>
                </div>

                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 7,
                      fontSize: 12.5,
                      fontWeight: 500,
                      background: sev.fundo,
                      color: sev.cor,
                    }}
                  >
                    <AlertTriangle size={14} />
                    Severidade {sev.label}
                  </span>
                  <span
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                      padding: "6px 12px",
                      borderRadius: 7,
                      fontSize: 12.5,
                      fontWeight: 500,
                      background: palette.panelAlt,
                      color: st.cor,
                      border: `1px solid ${palette.border}`,
                    }}
                  >
                    <StatusIcon size={14} />
                    {st.label}
                  </span>
                </div>
              </div>

              <div
                style={{
                  marginTop: 24,
                  padding: 18,
                  borderRadius: 8,
                  background: palette.panelAlt,
                  border: `1px solid ${palette.border}`,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
                  <Gauge size={15} color={palette.accent} />
                  <span style={{ fontSize: 13.5, color: palette.textMuted }}>
                    Parâmetro monitorado
                  </span>
                </div>
                <div style={{ fontSize: 16, fontWeight: 500, marginBottom: 14 }}>
                  {ocorrencia.parametro}
                </div>

                <div style={{ display: "flex", gap: 32, flexWrap: "wrap" }}>
                  <div>
                    <div style={{ fontSize: 12, color: palette.textFaint, marginBottom: 4 }}>
                      Valor registrado
                    </div>
                    <div
                      className="mono"
                      style={{
                        fontSize: 26,
                        fontWeight: 600,
                        color: excedeu ? sev.cor : palette.textPrimary,
                      }}
                    >
                      {formatNumero(ocorrencia.valor)}
                      <span style={{ fontSize: 14, color: palette.textFaint, marginLeft: 4 }}>
                        {ocorrencia.unidade}
                      </span>
                    </div>
                  </div>
                  <div>
                    <div style={{ fontSize: 12, color: palette.textFaint, marginBottom: 4 }}>
                      Limiar configurado
                    </div>
                    <div className="mono" style={{ fontSize: 26, fontWeight: 600 }}>
                      {formatNumero(ocorrencia.limiar)}
                      <span style={{ fontSize: 14, color: palette.textFaint, marginLeft: 4 }}>
                        {ocorrencia.unidade}
                      </span>
                    </div>
                  </div>
                </div>

                <Barra valor={ocorrencia.valor} limiar={ocorrencia.limiar} cor={sev.cor} />
              </div>

              <div
                style={{
                  marginTop: 20,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 14,
                }}
                className="sigvia-info-grid"
              >
                <InfoLinha icon={MapPin} rotulo="Coordenadas" valor={ocorrencia.coordenadas} mono />
                <InfoLinha icon={Radio} rotulo="Sensor / equipamento" valor={ocorrencia.sensorId} mono />
                <InfoLinha icon={Activity} rotulo="Duração do evento" valor={ocorrencia.duracao} />
                <InfoLinha icon={User} rotulo="Responsável" valor={ocorrencia.responsavel} />
              </div>

              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 8,
                    color: palette.textMuted,
                    fontSize: 13.5,
                  }}
                >
                  <FileText size={15} />
                  Observações técnicas
                </div>
                <p
                  style={{
                    fontSize: 13.5,
                    lineHeight: 1.6,
                    color: palette.textPrimary,
                    margin: 0,
                    padding: 14,
                    background: palette.panelAlt,
                    border: `1px solid ${palette.border}`,
                    borderRadius: 8,
                  }}
                >
                  {ocorrencia.observacoes}
                </p>
              </div>

              <div style={{ marginTop: 20 }}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    marginBottom: 10,
                    color: palette.textMuted,
                    fontSize: 13.5,
                  }}
                >
                  <Navigation size={15} />
                  Histórico do evento
                </div>
                <div style={{ borderLeft: `2px solid ${palette.border}`, paddingLeft: 16 }}>
                  {ocorrencia.historico.map((h, i) => (
                    <div
                      key={i}
                      style={{
                        position: "relative",
                        paddingBottom: i === ocorrencia.historico.length - 1 ? 0 : 16,
                      }}
                    >
                      <span
                        style={{
                          position: "absolute",
                          left: -21,
                          top: 4,
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: palette.accent,
                        }}
                      />
                      <span className="mono" style={{ fontSize: 12, color: palette.textFaint }}>
                        {h.hora}
                      </span>
                      <div style={{ fontSize: 13, color: palette.textPrimary, marginTop: 2 }}>
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