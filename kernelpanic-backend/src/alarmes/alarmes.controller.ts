import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { Publico } from '../autenticacao/publico.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { RegiaoQueryDto, resolverRegiao } from '../regiao/regiao';
import { AlarmesService } from './alarmes.service';
import { AlarmeHistoricoRespostaDto } from './dto/alarme-historico-resposta.dto';
import { AtualizarStatusAlarmeDto } from './dto/atualizar-status-alarme.dto';
import { ListaAlarmesRespostaDto } from './dto/lista-alarmes-resposta.dto';
import { ListarAlarmesQueryDto } from './dto/listar-alarmes-query.dto';
import { OpcoesFiltroRespostaDto } from './dto/opcoes-filtro-resposta.dto';

@Controller('alarmes')
@UseGuards(GuardaJwt)
export class AlarmesController {
  constructor(
    private readonly alarmesService: AlarmesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Publico()
  async listarHistorico(
    @Query() query: ListarAlarmesQueryDto,
    @UsuarioAutenticado() usuario: PayloadJwt | null,
  ): Promise<ListaAlarmesRespostaDto> {
    return this.alarmesService.listarHistorico(query, resolverRegiao(query, Boolean(usuario)));
  }

  @Get('filtros')
  @Publico()
  async buscarOpcoesFiltro(
    @Query() query: RegiaoQueryDto,
    @UsuarioAutenticado() usuario: PayloadJwt | null,
  ): Promise<OpcoesFiltroRespostaDto> {
    return this.alarmesService.buscarOpcoesFiltro(resolverRegiao(query, Boolean(usuario)));
  }

  @Patch(':id')
  async atualizarStatus(
    @Param('id') id: string,
    @Body() dto: AtualizarStatusAlarmeDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<AlarmeHistoricoRespostaDto> {
    const alarme = await this.alarmesService.atualizarStatus(id, dto);
    await this.auditoriaService.registrar({
      acao: 'alarmes.atualizarStatus',
      entidade: 'Alarme',
      entidadeId: id,
      usuarioId: usuario.sub,
      detalhes: { status: dto.status },
    });
    return alarme;
  }
}
