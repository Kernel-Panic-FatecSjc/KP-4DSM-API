import { Body, Controller, Get, Post, Query, Res, UseGuards } from '@nestjs/common';
import type { Response } from 'express';
import { ApiCookieAuth, ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { enviarCsv } from '../exportacao/csv';
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
    summary: 'Compara estatísticas entre períodos em uma ou mais estações',
    description:
      'Informe periodos repetido na query string, cada um como ISO_INICIO|ISO_FIM. O primeiro período é a referência; cada período seguinte é comparado a ele. Períodos inclusivos sobrepostos são rejeitados. Diferença absoluta = comparado - referência; percentual = diferença / valor absoluto da referência × 100; percentual fica null quando a referência é zero. Variância (VAR_POP) e desvio padrão (STDDEV_POP) são populacionais.',
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
      detalhes: { estacaoIds: query.estacaoIds, parametroId: query.parametroId, periodos: query.periodos },
    });
    return relatorio;
  }

  @Get('estatisticas/exportar.csv')
  @ApiOperation({ summary: 'Exporta em CSV a síntese estatística dos filtros informados' })
  async exportarCsv(
    @Query() query: ConsultarEstatisticasDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
    @Res() resposta: Response,
  ): Promise<void> {
    const relatorio = await this.estatisticaService.comparar(query, usuario);
    await this.auditoriaService.registrar({
      acao: 'relatorios.estatisticas.exportar.csv',
      entidade: 'RelatorioEstatistico',
      ...autoria(usuario),
      detalhes: { formato: 'CSV', estacaoIds: query.estacaoIds, parametroId: query.parametroId, periodos: query.periodos },
    });

    async function* linhas() {
      for (const periodo of relatorio.periodos) {
        yield periodo.estacoes.map((estacao) => [
          periodo.inicio,
          periodo.fim,
          estacao.estacaoId,
          estacao.estacaoNome,
          estacao.quantidade,
          estacao.media,
          estacao.mediana,
          estacao.desvioPadrao,
          estacao.variancia,
          estacao.quartil1,
          estacao.quartil2,
          estacao.quartil3,
          estacao.minimo,
          estacao.maximo,
        ]);
      }
    }

    await enviarCsv(resposta, 'sintese-estatistica.csv', [
      'Início do período', 'Fim do período', 'ID da estação', 'Estação', 'Leituras',
      'Média', 'Mediana', 'Desvio padrão', 'Variância', '1º quartil', '2º quartil',
      '3º quartil', 'Mínimo', 'Máximo',
    ], linhas());
  }

  @Post('estatisticas/exportar-pdf')
  @ApiOperation({ summary: 'Registra a solicitação de impressão do relatório estatístico em PDF' })
  async registrarExportacaoPdf(
    @Body() filtros: ConsultarEstatisticasDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<{ mensagem: string }> {
    await this.auditoriaService.registrar({
      acao: 'relatorios.estatisticas.exportar.pdf',
      entidade: 'RelatorioEstatistico',
      ...autoria(usuario),
      detalhes: { formato: 'PDF', estacaoIds: filtros.estacaoIds, parametroId: filtros.parametroId, periodos: filtros.periodos },
    });
    return { mensagem: 'Exportação registrada' };
  }
}
