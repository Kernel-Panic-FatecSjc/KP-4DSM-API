import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { ConsultarEstatisticasDto } from './dto/estatistica-resposta';
import { RelatorioEstatisticoDto } from './dto/estatistica-relatorio';
import { EstatisticaService } from './estatica.service';

@ApiTags('Relatórios')
@ApiCookieAuth('access_token')
@Controller('relatorios')
@UseGuards(GuardaJwt, GuardaPerfil)
export class EstatisticaController {
  constructor(
    private readonly estatisticaService: EstatisticaService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get('estatisticas')
  @ApiOperation({
    summary: 'Compara estatísticas de duas ou mais estações',
    description:
      'Calcula as estatísticas das leituras no período. Variância (VAR_POP) e desvio padrão (STDDEV_POP) são populacionais. Informe estacaoIds repetido na query string para cada estação.',
  })
  @ApiResponse({ status: 200, type: RelatorioEstatisticoDto })
  async comparar(
    @Query() query: ConsultarEstatisticasDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<RelatorioEstatisticoDto> {
    const relatorio = await this.estatisticaService.comparar(query, usuario);
    await this.auditoriaService.registrar({
      acao: 'relatorios.estatisticas.consultar',
      entidade: 'RelatorioEstatistico',
      ...autoria(usuario),
      detalhes: { estacaoIds: query.estacaoIds, parametroId: query.parametroId, dataInicio: query.dataInicio, dataFim: query.dataFim },
    });
    return relatorio;
  }
}
