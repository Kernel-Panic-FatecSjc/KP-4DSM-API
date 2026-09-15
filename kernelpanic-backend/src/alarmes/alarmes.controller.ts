import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { AlarmesService } from './alarmes.service';
import { ListaAlarmesRespostaDto } from './dto/lista-alarmes-resposta.dto';
import { ListarAlarmesQueryDto } from './dto/listar-alarmes-query.dto';
import { OpcoesFiltroRespostaDto } from './dto/opcoes-filtro-resposta.dto';

@Controller('alarmes')
@UseGuards(GuardaJwt)
export class AlarmesController {
  constructor(private readonly alarmesService: AlarmesService) {}

  @Get()
  async listarHistorico(@Query() query: ListarAlarmesQueryDto): Promise<ListaAlarmesRespostaDto> {
    return this.alarmesService.listarHistorico(query);
  }

  @Get('filtros')
  async buscarOpcoesFiltro(): Promise<OpcoesFiltroRespostaDto> {
    return this.alarmesService.buscarOpcoesFiltro();
  }
}
