import { randomUUID } from 'node:crypto';
import { Controller, Get, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import {
  ApiBadRequestResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiProduces,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { RotaLogada } from '../documentacao/respostas';
import { autoria } from '../auditoria/autoria';
import {
  HistoricoClimaticoQueryDto,
  GRANULARIDADES_HISTORICO,
} from './dto/historico-climatico-query.dto';
import { HistoricoClimaticoRespostaDto } from './dto/historico-climatico-resposta.dto';
import { IncidentesQueryDto } from './dto/incidentes-query.dto';
import { RelatorioIncidentesDto } from './dto/incidentes-resposta.dto';
import { IncidentesService } from './incidentes.service';
import { CABECALHO_CSV_INCIDENTES, linhaCsvIncidente, montarLaudoIncidentes } from './laudo-incidentes';
import { enviarCsv } from '../exportacao/csv';
import { enviarPdf } from '../exportacao/pdf';
import { RelatoriosService } from './relatorios.service';

@Controller('relatorios')
@UseGuards(GuardaJwt, GuardaPerfil)
@ApiTags('relatorios')
@RotaLogada()
export class RelatoriosController {
  constructor(
    private readonly relatoriosService: RelatoriosService,
    private readonly incidentesService: IncidentesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get('incidentes')
  @ApiOperation({
    summary: 'Relatório de incidentes e ocorrências de alertas (relatório 2)',
    description:
      'Agrupa os alarmes do período em ocorrências (alarmes consecutivos do mesmo alerta, com intervalo até a tolerância) e devolve, para cada uma, a estação, o parâmetro que superou o limiar, o operador e o valor limite, o valor de pico, a duração e as ações (quem reconheceu ou resolveu e quando), além dos resumos por severidade e por estação. O período se aplica ao instante da leitura; datas sem horário valem o dia inteiro (UTC). Região: raio em km em torno de latitude/longitude e/ou trecho do endereço da estação.',
  })
  @ApiOkResponse({ type: RelatorioIncidentesDto })
  @ApiBadRequestResponse({
    description: 'Período inválido ou ausente, latitude sem longitude (ou o contrário), filtros fora da faixa, ou alarmes demais no período.',
  })
  @ApiForbiddenResponse({ description: 'Usuário de licitação pedindo outra licitação.' })
  async incidentes(
    @Query() query: IncidentesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<RelatorioIncidentesDto> {
    const relatorio = await this.incidentesService.relatorio(query, usuario);
    await this.auditoriaService.registrar({
      acao: 'relatorios.incidentes',
      entidade: 'RelatorioIncidentes',
      ...autoria(usuario),
      detalhes: {
        de: relatorio.de,
        ate: relatorio.ate,
        toleranciaMinutos: relatorio.toleranciaMinutos,
        ...filtrosParaAuditoria(relatorio),
        ocorrencias: relatorio.ocorrencias.length,
      },
    });
    return relatorio;
  }

  @Get('incidentes/pdf')
  @ApiOperation({
    summary: 'Emitir o laudo consolidado de incidentes em PDF',
    description:
      'Mesmos filtros de GET /relatorios/incidentes. O laudo traz identificação do órgão, período e filtros, resumo por severidade e por estação, tabela de ocorrências, responsável pela emissão e data/hora, e recebe um identificador único (cabeçalho X-Laudo-Id) registrado na trilha de auditoria, para rastrear o documento anexado a um decreto de emergência.',
  })
  @ApiProduces('application/pdf')
  @ApiOkResponse({ description: 'Arquivo PDF do laudo.' })
  @ApiBadRequestResponse({ description: 'Mesmas validações do relatório.' })
  async laudoIncidentes(
    @Query() query: IncidentesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
    @Res() resposta: Response,
  ): Promise<void> {
    const relatorio = await this.incidentesService.relatorio(query, usuario);
    const { emitidoPor, orgao } = await this.incidentesService.emissor(usuario, relatorio.filtros.licitacaoId);
    const laudoId = randomUUID();
    const emitidoEm = new Date();
    const documento = montarLaudoIncidentes(relatorio, { laudoId, orgao, emitidoPor, emitidoEm });

    await this.auditoriaService.registrar({
      acao: 'relatorios.incidentes.laudo',
      entidade: 'LaudoIncidentes',
      entidadeId: laudoId,
      ...autoria(usuario),
      detalhes: {
        de: relatorio.de,
        ate: relatorio.ate,
        toleranciaMinutos: relatorio.toleranciaMinutos,
        ...filtrosParaAuditoria(relatorio),
        ocorrencias: relatorio.ocorrencias.length,
        emitidoEm: emitidoEm.toISOString(),
      },
    });

    resposta.setHeader('X-Laudo-Id', laudoId);
    await enviarPdf(resposta, `laudo-incidentes-${laudoId}.pdf`, documento);
  }

  @Get('incidentes/csv')
  @ApiOperation({
    summary: 'Exportar as ocorrências do relatório de incidentes em CSV',
    description: 'Mesmos filtros de GET /relatorios/incidentes; uma linha por ocorrência. A exportação é registrada na trilha de auditoria.',
  })
  @ApiProduces('text/csv')
  @ApiOkResponse({ description: 'Arquivo CSV (separador ";", UTF-8 com BOM).' })
  @ApiBadRequestResponse({ description: 'Mesmas validações do relatório.' })
  async exportarIncidentes(
    @Query() query: IncidentesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
    @Res() resposta: Response,
  ): Promise<void> {
    const relatorio = await this.incidentesService.relatorio(query, usuario);
    await this.auditoriaService.registrar({
      acao: 'relatorios.incidentes.exportar',
      entidade: 'RelatorioIncidentes',
      ...autoria(usuario),
      detalhes: {
        de: relatorio.de,
        ate: relatorio.ate,
        toleranciaMinutos: relatorio.toleranciaMinutos,
        ...filtrosParaAuditoria(relatorio),
        ocorrencias: relatorio.ocorrencias.length,
      },
    });

    async function* lotes() {
      yield relatorio.ocorrencias.map(linhaCsvIncidente);
    }
    await enviarCsv(resposta, 'incidentes.csv', CABECALHO_CSV_INCIDENTES, lotes());
  }

  @Get('historico-climatico')
  @ApiOperation({
    summary: 'Consultar histórico climático consolidado',
    description:
      'Agrega no PostgreSQL por hora ou dia, no fuso UTC. Datas sem horário são interpretadas como dias UTC completos; os limites são inclusivos. O valor consolidado usa SOMA ou MEDIA conforme o tipo de parâmetro, e a resposta também inclui soma, média, mínimo, máximo e quantidade de leituras.',
  })
  @ApiQuery({
    name: 'de',
    required: true,
    type: String,
    example: '2026-01-01',
    description: 'Início inclusivo (data ISO ou instante ISO 8601).',
  })
  @ApiQuery({
    name: 'ate',
    required: true,
    type: String,
    example: '2026-12-31',
    description: 'Fim inclusivo (data ISO ou instante ISO 8601).',
  })
  @ApiQuery({
    name: 'granularidade',
    required: true,
    enum: GRANULARIDADES_HISTORICO,
  })
  @ApiQuery({
    name: 'estacaoIds',
    required: false,
    type: String,
    isArray: true,
    description:
      'UUIDs das estações; repita o parâmetro para filtrar mais de uma.',
  })
  @ApiOkResponse({ type: HistoricoClimaticoRespostaDto, description: 'Histórico consolidado por estação, parâmetro e período.' })
  @ApiBadRequestResponse({
    description:
      'Datas, granularidade ou UUIDs inválidos; início posterior ao fim.',
  })
  async historicoClimatico(
    @Query() query: HistoricoClimaticoQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<HistoricoClimaticoRespostaDto> {
    const estacaoIds = [
      ...new Set([
        ...(query.estacaoIds ?? []),
        ...(query.estacaoIdsComColchetes ?? []),
      ]),
    ];
    const consulta = {
      ...query,
      estacaoIds: estacaoIds.length ? estacaoIds : undefined,
    };
    const resposta = await this.relatoriosService.historicoClimatico(
      consulta,
      usuario,
    );
    await this.auditoriaService.registrar({
      acao: 'relatorios.historico-climatico',
      entidade: 'RelatorioHistoricoClimatico',
      ...autoria(usuario),
      detalhes: {
        de: resposta.de,
        ate: resposta.ate,
        granularidade: query.granularidade,
        estacaoIds: consulta.estacaoIds ?? [],
      },
    });
    return resposta;
  }
}

/** Filtros informados, sem os vazios (o JSON da trilha não guarda undefined). */
export function filtrosParaAuditoria(relatorio: Pick<RelatorioIncidentesDto, 'filtros'>): Record<string, string | number> {
  const { severidade, regiao, endereco, licitacaoId } = relatorio.filtros;
  return Object.fromEntries(
    Object.entries({
      severidade,
      latitude: regiao?.latitude,
      longitude: regiao?.longitude,
      raioKm: regiao?.raioKm,
      endereco,
      licitacaoId,
    }).filter((entrada): entrada is [string, string | number] => entrada[1] !== undefined),
  );
}
