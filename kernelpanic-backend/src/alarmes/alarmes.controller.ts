import { ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Publico } from '../autenticacao/publico.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { autoria } from '../auditoria/autoria';
import { Conflito, NaoEncontrado, Proibido, RequisicaoInvalida, RotaLogada, RotaPublicaComLimite } from '../documentacao/respostas';
import { resolverRegiao } from '../regiao/regiao';
import { AlarmesService } from './alarmes.service';
import { AlarmeHistoricoRespostaDto } from './dto/alarme-historico-resposta.dto';
import { AtualizarStatusAlarmeDto } from './dto/atualizar-status-alarme.dto';
import { ListaAlarmesRespostaDto } from './dto/lista-alarmes-resposta.dto';
import { FiltrosAlarmesQueryDto, ListarAlarmesQueryDto } from './dto/listar-alarmes-query.dto';
import { OpcoesFiltroRespostaDto } from './dto/opcoes-filtro-resposta.dto';

@ApiTags('alarmes')
@Controller('alarmes')
@UseGuards(GuardaJwt, GuardaPerfil)
export class AlarmesController {
  constructor(
    private readonly alarmesService: AlarmesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Publico()
  @RotaPublicaComLimite()
  @ApiOperation({
    summary: 'Listar histórico de alarmes',
    description:
      'Rota pública: o visitante sem login precisa informar latitude e longitude e só vê alarmes de estações num raio de 100 km. Quem está logado vê os da própria licitação (a Tecsus, de todas).',
  })
  @ApiOkResponse({ type: ListaAlarmesRespostaDto, description: 'Página de alarmes.' })
  @RequisicaoInvalida('Filtro inválido, ou visitante sem latitude e longitude.')
  async listarHistorico(
    @Query() query: ListarAlarmesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado | null,
  ): Promise<ListaAlarmesRespostaDto> {
    return this.alarmesService.listarHistorico(query, resolverRegiao(query, Boolean(usuario)), usuario);
  }

  @Get('filtros')
  @Publico()
  @RotaPublicaComLimite()
  @ApiOperation({
    summary: 'Opções dos filtros de alarmes',
    description: 'Estações, sensores, severidades e status que o chamador pode usar para filtrar. Visitante sem login precisa informar latitude e longitude.',
  })
  @ApiOkResponse({ type: OpcoesFiltroRespostaDto, description: 'Opções de filtro.' })
  @RequisicaoInvalida('Filtro inválido, ou visitante sem latitude e longitude.')
  async buscarOpcoesFiltro(
    @Query() query: FiltrosAlarmesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado | null,
  ): Promise<OpcoesFiltroRespostaDto> {
    return this.alarmesService.buscarOpcoesFiltro(resolverRegiao(query, Boolean(usuario)), usuario, query.licitacaoId);
  }

  @Patch(':id')
  @RotaLogada()
  @ApiOperation({ summary: 'Atualizar status do alarme', description: 'O status só avança: ABERTO, RECONHECIDO, RESOLVIDO.' })
  @ApiParam({ name: 'id', description: 'Identificador (UUID) do alarme.', example: '9d6d2d7e-1c3a-4e8e-8f10-2b8a4a0c7e55' })
  @ApiOkResponse({ type: AlarmeHistoricoRespostaDto, description: 'Alarme com o novo status.' })
  @RequisicaoInvalida('Status inválido.')
  @Proibido('Alarme de outra licitação.')
  @NaoEncontrado('Alarme inexistente.')
  @Conflito('Tentativa de voltar o alarme para um status anterior ou igual ao atual.')
  async atualizarStatus(
    @Param('id') id: string,
    @Body() dto: AtualizarStatusAlarmeDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<AlarmeHistoricoRespostaDto> {
    const alarme = await this.alarmesService.atualizarStatus(id, dto, usuario);
    await this.auditoriaService.registrar({
      acao: 'alarmes.atualizarStatus',
      entidade: 'Alarme',
      entidadeId: id,
      ...autoria(usuario),
      detalhes: { status: dto.status },
    });
    return alarme;
  }
}
