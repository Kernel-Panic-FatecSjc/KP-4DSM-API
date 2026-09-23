import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { AlertasService } from './alertas.service';
import { ListaAlertasRespostaDto } from './dto/lista-alertas-resposta.dto';
import { ListarAlertasQueryDto } from './dto/listar-alertas-query.dto';
import { OpcoesFiltroAlertasRespostaDto } from './dto/opcoes-filtro-alertas-resposta.dto';

@Controller('alertas')
@UseGuards(GuardaJwt)
export class AlertasController {
  constructor(
    private readonly alertasService: AlertasService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  async listar(
    @Query() query: ListarAlertasQueryDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<ListaAlertasRespostaDto> {
    const resultado = await this.alertasService.listar(query);
    await this.auditoriaService.registrar({
      acao: 'alertas.consultar',
      entidade: 'Alerta',
      usuarioId: usuario.sub,
      detalhes: { ...query },
    });
    return resultado;
  }

  @Get('filtros')
  async buscarOpcoesFiltro(): Promise<OpcoesFiltroAlertasRespostaDto> {
    return this.alertasService.buscarOpcoesFiltro();
  }
}
