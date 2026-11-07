import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCookieAuth,
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
    private readonly auditoriaService: AuditoriaService,
  ) {}

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
