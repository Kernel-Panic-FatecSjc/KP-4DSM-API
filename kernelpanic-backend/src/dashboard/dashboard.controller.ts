import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { RequisicaoInvalida, RotaLogada } from '../documentacao/respostas';
import { DashboardService } from './dashboard.service';
import { DashboardQueryDto } from './dto/dashboard-query.dto';
import { DashboardRespostaDto } from './dto/dashboard-resposta.dto';

@ApiTags('dashboard')
@Controller('dashboard')
@UseGuards(GuardaJwt, GuardaPerfil)
@RotaLogada()
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get()
  @ApiOperation({
    summary: 'Dados do dashboard',
    description:
      'Indicadores e séries de medições do período. A Tecsus vê o dashboard geral (ou o de uma licitação); o usuário de licitação vê o da própria licitação. Sem período, vale as últimas 24 horas.',
  })
  @ApiOkResponse({ type: DashboardRespostaDto, description: 'Indicadores, estações e séries do período.' })
  @RequisicaoInvalida('Período inválido: datas inválidas, início depois do fim, `de`/`ate` com período predefinido, ou customizado sem `de` e `ate`.')
  buscarDados(@Query() query: DashboardQueryDto, @UsuarioAutenticado() usuario: UsuarioLogado): Promise<DashboardRespostaDto> {
    return this.dashboardService.buscarDados(query, usuario);
  }
}
