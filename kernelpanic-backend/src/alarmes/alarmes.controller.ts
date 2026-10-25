import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Publico } from '../autenticacao/publico.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { autoria } from '../auditoria/autoria';
import { resolverRegiao } from '../regiao/regiao';
import { AlarmesService } from './alarmes.service';
import { AlarmeHistoricoRespostaDto } from './dto/alarme-historico-resposta.dto';
import { AtualizarStatusAlarmeDto } from './dto/atualizar-status-alarme.dto';
import { ListaAlarmesRespostaDto } from './dto/lista-alarmes-resposta.dto';
import { FiltrosAlarmesQueryDto, ListarAlarmesQueryDto } from './dto/listar-alarmes-query.dto';
import { OpcoesFiltroRespostaDto } from './dto/opcoes-filtro-resposta.dto';

@Controller('alarmes')
@UseGuards(GuardaJwt, GuardaPerfil)
export class AlarmesController {
  constructor(
    private readonly alarmesService: AlarmesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Publico()
  async listarHistorico(
    @Query() query: ListarAlarmesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado | null,
  ): Promise<ListaAlarmesRespostaDto> {
    return this.alarmesService.listarHistorico(query, resolverRegiao(query, Boolean(usuario)), usuario);
  }

  @Get('filtros')
  @Publico()
  async buscarOpcoesFiltro(
    @Query() query: FiltrosAlarmesQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado | null,
  ): Promise<OpcoesFiltroRespostaDto> {
    return this.alarmesService.buscarOpcoesFiltro(resolverRegiao(query, Boolean(usuario)), usuario, query.licitacaoId);
  }

  @Patch(':id')
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
