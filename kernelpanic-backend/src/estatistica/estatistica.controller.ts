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
import { enviarPdf, montarRelatorioPdf, secaoPdf, tabelaPdf } from '../exportacao/pdf';
import { ConsultarEstatisticasDto } from './dto/estatistica-resposta';
import { RelatorioEstatisticoDto } from './dto/estatistica-relatorio';
import { EstatisticaService } from './estatistica.service';

@ApiTags('relatorios')
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
  @ApiOperation({
    summary: 'Exporta em CSV a síntese estatística dos filtros informados',
    description:
      'Gera um arquivo CSV com as estatísticas de cada estação e período informado na consulta. Reutiliza os mesmos filtros e validações da comparação de estatísticas.',
  })
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
        ].map((valor) => typeof valor === 'number' ? valor.toLocaleString('pt-BR') : valor));
      }
    }

    await enviarCsv(resposta, 'sintese-estatistica.csv', [
      'Início do período', 'Fim do período', 'ID da estação', 'Estação', 'Leituras',
      'Média', 'Mediana', 'Desvio padrão', 'Variância', '1º quartil', '2º quartil',
      '3º quartil', 'Mínimo', 'Máximo',
    ], linhas());
  }

  @Post('estatisticas/exportar-pdf')
  @ApiOperation({
    summary: 'Gera e exporta o relatório estatístico em PDF',
    description:
      'Gera no backend o PDF estatístico com os mesmos filtros e dados da comparação e registra a exportação na auditoria.',
  })
  async registrarExportacaoPdf(
    @Body() filtros: ConsultarEstatisticasDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
    @Res() resposta: Response,
  ): Promise<void> {
    const relatorio = await this.estatisticaService.comparar(filtros, usuario);
    await this.auditoriaService.registrar({
      acao: 'relatorios.estatisticas.exportar.pdf',
      entidade: 'RelatorioEstatistico',
      ...autoria(usuario),
      detalhes: { formato: 'PDF', estacaoIds: filtros.estacaoIds, parametroId: filtros.parametroId, periodos: filtros.periodos },
    });
    const conteudo = [
      secaoPdf('Síntese estatística'),
      ...relatorio.periodos.flatMap((periodo, indice) => [
        secaoPdf(`Período ${indice + 1}: ${periodo.inicio.toLocaleDateString('pt-BR')} a ${periodo.fim.toLocaleDateString('pt-BR')}`),
        tabelaPdf(
          ['Estação', 'Leituras', 'Média', 'Mediana', 'Desvio padrão', 'Variância', 'Q1', 'Q3', 'Mínimo', 'Máximo'],
          periodo.estacoes.map((estacao) => [estacao.estacaoNome, estacao.quantidade, estacao.media, estacao.mediana, estacao.desvioPadrao, estacao.variancia, estacao.quartil1, estacao.quartil3, estacao.minimo, estacao.maximo]),
          { larguras: ['*', 38, 44, 44, 52, 48, 38, 38, 42, 42], colunasNumero: [1, 2, 3, 4, 5, 6, 7, 8, 9] },
        ),
      ]),
      secaoPdf('Microclimas em risco'),
      tabelaPdf(
        ['Período', 'Estação', 'Mediana', 'Média do grupo', 'Diferença'],
        relatorio.microclimasRisco.map((risco) => [risco.periodoIndice + 1, risco.estacaoNome, risco.media, risco.medianaGrupo, risco.diferencaParaMediana]),
        { colunasNumero: [0, 2, 3, 4] },
      ),
    ];
    await enviarPdf(resposta, 'relatorio-estatistico.pdf', montarRelatorioPdf({
      titulo: 'Relatório estatístico comparativo',
      subtitulo: relatorio.metodoCalculo,
      filtros: [
        { rotulo: 'Estações', valor: filtros.estacaoIds.join(', ') },
        { rotulo: 'Parâmetro', valor: filtros.parametroId },
        ...filtros.periodos.map((periodo, indice) => ({ rotulo: `Período ${indice + 1}`, valor: periodo.replace('|', ' até ') })),
      ],
      conteudo,
      emitidoPor: usuario.email,
      orientacao: 'landscape',
    }));
  }
}
