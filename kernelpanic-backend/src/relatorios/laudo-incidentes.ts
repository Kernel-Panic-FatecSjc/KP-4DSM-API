import type { Content, TDocumentDefinitions } from 'pdfmake/interfaces';
import type { SeveridadeAlerta, StatusAlarme } from '../generated/prisma/client';
import { formatarDataHora, montarRelatorioPdf, secaoPdf, tabelaPdf, type FiltroRelatorio } from '../exportacao/pdf';
import type { OcorrenciaIncidenteDto, RelatorioIncidentesDto } from './dto/incidentes-resposta.dto';
import type { AcaoOcorrencia, Ocorrencia } from './ocorrencias';

// Laudo consolidado do relatório 2 (US10, SCRUM-62), para anexar a decretos
// municipais/estaduais de situação de emergência. Usa o layout base da US09
// (src/exportacao/pdf.ts).

export const ROTULO_SEVERIDADE: Record<SeveridadeAlerta, string> = {
  ATENCAO: 'Atenção',
  ALERTA: 'Alerta',
  EMERGENCIA: 'Emergência',
};

const ROTULO_STATUS: Record<StatusAlarme, string> = {
  ABERTO: 'Aberta',
  RECONHECIDO: 'Reconhecida',
  RESOLVIDO: 'Resolvida',
};

const SIMBOLO_OPERADOR: Record<string, string> = {
  MAIOR_QUE: '>',
  MENOR_QUE: '<',
  IGUAL_A: '=',
  DIFERENTE_DE: '≠',
  MAIOR_OU_IGUAL: '≥',
  MENOR_OU_IGUAL: '≤',
};

/** Órgão do laudo: a licitação filtrada (ou a do usuário). Nula = Tecsus consultando todas. */
export interface OrgaoLaudo {
  orgaoNome: string;
  orgaoMunicipio: string;
  orgaoUf: string;
  numeroContrato: string;
  codigoIdentificador: string;
}

export interface OpcoesLaudo {
  laudoId: string;
  orgao: OrgaoLaudo | null;
  emitidoPor: string;
  emitidoEm: Date;
}

type OcorrenciaLaudo = Ocorrencia | OcorrenciaIncidenteDto;

/** Data e hora curtas (dd/mm/aaaa hh:mm) no horário de Brasília. */
function dataHoraCurta(data: Date): string {
  return data.toLocaleString('pt-BR', {
    timeZone: 'America/Sao_Paulo',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function numero(valor: number): string {
  return valor.toLocaleString('pt-BR', { maximumFractionDigits: 2 });
}

/** Duração legível: "leitura única", "45 min", "2 h 05 min", "1 d 2 h". */
export function duracaoLegivel(segundos: number): string {
  if (segundos <= 0) return 'leitura única';
  const minutos = Math.round(segundos / 60);
  if (minutos < 1) return '< 1 min';
  const horas = Math.floor(minutos / 60);
  if (horas === 0) return `${minutos} min`;
  if (horas < 24) return `${horas} h ${String(minutos % 60).padStart(2, '0')} min`;
  return `${Math.floor(horas / 24)} d ${horas % 24} h`;
}

function acao(rotulo: string, registro: AcaoOcorrencia | null): string | null {
  if (!registro) return null;
  return `${rotulo}${registro.por ? ` por ${registro.por.nome}` : ''} em ${dataHoraCurta(new Date(registro.em))}`;
}

/** Ações correlacionadas numa linha só (PDF e CSV). */
export function textoAcoes(ocorrencia: OcorrenciaLaudo): string {
  return [
    ROTULO_STATUS[ocorrencia.status],
    acao('reconhecida', ocorrencia.reconhecimento),
    acao('resolvida', ocorrencia.resolucao),
    ...ocorrencia.observacoes.map((observacao) => `"${observacao}"`),
  ]
    .filter(Boolean)
    .join('; ');
}

export function filtrosDoLaudo(relatorio: RelatorioIncidentesDto): FiltroRelatorio[] {
  const { severidade, regiao, endereco } = relatorio.filtros;
  return [
    { rotulo: 'Período', valor: `${formatarDataHora(new Date(relatorio.de))} a ${formatarDataHora(new Date(relatorio.ate))}` },
    { rotulo: 'Severidade', valor: severidade ? ROTULO_SEVERIDADE[severidade] : 'Todas' },
    {
      rotulo: 'Região',
      valor: regiao
        ? `Raio de ${numero(regiao.raioKm)} km em torno de ${numero(regiao.latitude)}, ${numero(regiao.longitude)}`
        : 'Todas as estações',
    },
    ...(endereco ? [{ rotulo: 'Endereço', valor: `Contém "${endereco}"` }] : []),
    { rotulo: 'Agrupamento', valor: `Leituras acima do limiar com até ${relatorio.toleranciaMinutos} min de intervalo formam uma ocorrência` },
  ];
}

export function montarLaudoIncidentes(relatorio: RelatorioIncidentesDto, opcoes: OpcoesLaudo): TDocumentDefinitions {
  const { orgao } = opcoes;
  const instituicao = orgao ? `${orgao.orgaoNome} · ${orgao.orgaoMunicipio}/${orgao.orgaoUf}` : 'Tecsus · todas as licitações';
  const totais = relatorio.resumoPorSeveridade.reduce(
    (soma, resumo) => ({
      ocorrencias: soma.ocorrencias + resumo.ocorrencias,
      duracao: soma.duracao + resumo.duracaoTotalSegundos,
      leituras: soma.leituras + resumo.leituras,
    }),
    { ocorrencias: 0, duracao: 0, leituras: 0 },
  );

  const conteudo: Content[] = [
    secaoPdf('Identificação do laudo'),
    tabelaPdf(
      ['Campo', 'Valor'],
      [
        ['Identificador do laudo', opcoes.laudoId],
        ['Órgão', orgao?.orgaoNome ?? 'Tecsus (consulta de todas as licitações)'],
        ['Município/UF', orgao ? `${orgao.orgaoMunicipio}/${orgao.orgaoUf}` : '—'],
        ['Contrato', orgao ? `${orgao.numeroContrato} (${orgao.codigoIdentificador})` : '—'],
        ['Responsável pela emissão', opcoes.emitidoPor],
        ['Data/hora da emissão', formatarDataHora(opcoes.emitidoEm)],
      ],
      { larguras: [170, '*'] },
    ),
    secaoPdf('Resumo por severidade'),
    tabelaPdf(
      ['Severidade', 'Ocorrências', 'Duração total', 'Leituras acima do limiar'],
      [
        ...relatorio.resumoPorSeveridade.map((resumo) => [
          ROTULO_SEVERIDADE[resumo.severidade],
          resumo.ocorrencias,
          resumo.ocorrencias ? duracaoLegivel(resumo.duracaoTotalSegundos) : '—',
          resumo.leituras,
        ]),
        ['Total', totais.ocorrencias, totais.ocorrencias ? duracaoLegivel(totais.duracao) : '—', totais.leituras],
      ],
      { larguras: ['*', 90, 110, 130], colunasNumero: [1, 3], linhasTotal: 1 },
    ),
  ];

  if (relatorio.resumoPorEstacao.length > 0) {
    conteudo.push(
      secaoPdf('Resumo por estação'),
      tabelaPdf(
        ['Estação', 'Ocorrências', 'Duração total', 'Leituras acima do limiar', 'Maior severidade'],
        relatorio.resumoPorEstacao.map((resumo) => [
          resumo.estacao.nome,
          resumo.ocorrencias,
          duracaoLegivel(resumo.duracaoTotalSegundos),
          resumo.leituras,
          ROTULO_SEVERIDADE[resumo.maiorSeveridade],
        ]),
        { larguras: ['*', 80, 100, 120, 100], colunasNumero: [1, 3] },
      ),
    );
  }

  conteudo.push(
    secaoPdf('Ocorrências'),
    relatorio.ocorrencias.length > 0
      ? tabelaPdf(
          ['Início', 'Fim', 'Estação', 'Parâmetro violado', 'Limiar', 'Pico', 'Duração', 'Severidade', 'Ações correlacionadas'],
          relatorio.ocorrencias.map((ocorrencia) => {
            const unidade = ocorrencia.parametro.unidade;
            return [
              dataHoraCurta(new Date(ocorrencia.inicio)),
              dataHoraCurta(new Date(ocorrencia.fim)),
              ocorrencia.estacao.nome,
              ocorrencia.parametro.nome,
              `${SIMBOLO_OPERADOR[ocorrencia.operador] ?? ocorrencia.operador} ${numero(ocorrencia.valorLimite)} ${unidade}`,
              `${numero(ocorrencia.valorPico)} ${unidade}`,
              `${duracaoLegivel(ocorrencia.duracaoSegundos)} (${ocorrencia.leituras} leit.)`,
              ROTULO_SEVERIDADE[ocorrencia.severidade],
              textoAcoes(ocorrencia),
            ];
          }),
          { larguras: [62, 62, '*', 70, 55, 55, 70, 55, 150] },
        )
      : { text: 'Nenhuma ocorrência de alerta no período e nos filtros informados.', italics: true, margin: [0, 4, 0, 0] },
    {
      text:
        'Horários no fuso de Brasília. Início e fim são os instantes da primeira e da última leitura acima do limiar registradas pelas estações. ' +
        `Este laudo é identificado por ${opcoes.laudoId}, e a emissão fica registrada na trilha de auditoria do sistema.`,
      fontSize: 7,
      margin: [0, 12, 0, 0],
    },
  );

  return montarRelatorioPdf({
    titulo: 'Laudo consolidado de incidentes e ocorrências de alertas',
    subtitulo: `Laudo nº ${opcoes.laudoId}`,
    instituicao,
    filtros: filtrosDoLaudo(relatorio),
    conteudo,
    emitidoEm: opcoes.emitidoEm,
    emitidoPor: opcoes.emitidoPor,
    orientacao: 'landscape',
  });
}

export const CABECALHO_CSV_INCIDENTES = [
  'Início',
  'Fim',
  'Duração (s)',
  'Estação',
  'Parâmetro',
  'Unidade',
  'Operador',
  'Valor limite',
  'Valor de pico',
  'Leituras acima do limiar',
  'Severidade',
  'Status',
  'Reconhecida em',
  'Reconhecida por',
  'Resolvida em',
  'Resolvida por',
  'Observações',
];

export function linhaCsvIncidente(ocorrencia: OcorrenciaLaudo): unknown[] {
  return [
    new Date(ocorrencia.inicio),
    new Date(ocorrencia.fim),
    ocorrencia.duracaoSegundos,
    ocorrencia.estacao.nome,
    ocorrencia.parametro.nome,
    ocorrencia.parametro.unidade,
    ocorrencia.operador,
    ocorrencia.valorLimite,
    ocorrencia.valorPico,
    ocorrencia.leituras,
    ocorrencia.severidade,
    ocorrencia.status,
    ocorrencia.reconhecimento ? new Date(ocorrencia.reconhecimento.em) : null,
    ocorrencia.reconhecimento?.por?.nome ?? null,
    ocorrencia.resolucao ? new Date(ocorrencia.resolucao.em) : null,
    ocorrencia.resolucao?.por?.nome ?? null,
    ocorrencia.observacoes.join(' | '),
  ];
}
