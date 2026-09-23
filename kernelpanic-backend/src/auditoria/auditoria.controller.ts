import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { AuditoriaService } from './auditoria.service';
import { ListaAuditoriaRespostaDto } from './dto/lista-auditoria-resposta.dto';
import { ListarAuditoriaQueryDto } from './dto/listar-auditoria-query.dto';

@Controller('auditoria')
@UseGuards(GuardaJwt, GuardaAdministrador)
export class AuditoriaController {
  constructor(private readonly auditoriaService: AuditoriaService) {}

  @Get()
  listar(@Query() query: ListarAuditoriaQueryDto): Promise<ListaAuditoriaRespostaDto> {
    return this.auditoriaService.listar(query);
  }
}