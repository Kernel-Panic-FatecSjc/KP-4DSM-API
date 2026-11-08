import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import {
  HistoricoClimaticoQueryDto,
  GRANULARIDADES_HISTORICO,
} from './dto/historico-climatico-query.dto';
import { HistoricoClimaticoRespostaDto } from './dto/historico-climatico-resposta.dto';
import { IncidentesQueryDto } from './dto/incidentes-query.dto';
import { RelatorioIncidentesDto } from './dto/incidentes-resposta.dto';
import { IncidentesService } from './incidentes.service';
import { RelatoriosService } from './relatorios.service';

@Controller('relatorios')
@UseGuards(GuardaJwt, GuardaPerfil)
@ApiTags('relatorios')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Cookie de sessão ausente ou inválido',
})
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
  @ApiOkResponse({ type: HistoricoClimaticoRespostaDto })
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
