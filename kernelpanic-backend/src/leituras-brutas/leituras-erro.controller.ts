import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { ListarLeiturasErroQueryDto } from './dto/listar-leituras-erro-query.dto';
import { LeiturasErroService } from './leituras-erro.service';

@Controller('leituras-erro')
@UseGuards(GuardaJwt, GuardaPerfil)
export class LeiturasErroController {
  constructor(private readonly leiturasErroService: LeiturasErroService) {}

  @Get()
  listar(@Query() query: ListarLeiturasErroQueryDto, @UsuarioAutenticado() usuario: UsuarioLogado) {
    return this.leiturasErroService.listar(query, usuario);
  }
}
