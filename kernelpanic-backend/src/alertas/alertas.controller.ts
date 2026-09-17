import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { AlertasService } from './alertas.service';
import { ListaAlertasRespostaDto } from './dto/lista-alertas-resposta.dto';
import { ListarAlertasQueryDto } from './dto/listar-alertas-query.dto';
import { OpcoesFiltroAlertasRespostaDto } from './dto/opcoes-filtro-alertas-resposta.dto';

@Controller('alertas')
@UseGuards(GuardaJwt)
export class AlertasController {
  constructor(private readonly alertasService: AlertasService) {}

  @Get()
  async listar(@Query() query: ListarAlertasQueryDto): Promise<ListaAlertasRespostaDto> {
    return this.alertasService.listar(query);
  }

  @Get('filtros')
  async buscarOpcoesFiltro(): Promise<OpcoesFiltroAlertasRespostaDto> {
    return this.alertasService.buscarOpcoesFiltro();
  }
}
