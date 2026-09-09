import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { UsuariosService } from '../usuarios/usuarios.service';
import { UsuarioRespostaDto } from '../usuarios/dto/usuario-resposta.dto';
import { AutenticacaoService } from './autenticacao.service';
import { obterOpcoesCookie } from './cookie.config';
import { LoginDto } from './dto/login.dto';
import { GuardaJwt } from './guarda-jwt.guard';
import type { PayloadJwt } from './payload-jwt.interface';
import { UsuarioAutenticado } from './usuario-autenticado.decorator';

const NOME_COOKIE = 'access_token';

@Controller('autenticacao')
export class AutenticacaoController {
  constructor(
    private readonly autenticacaoService: AutenticacaoService,
    private readonly usuariosService: UsuariosService,
    private readonly configService: ConfigService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Post('login')
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<UsuarioRespostaDto> {
    const usuario = await this.autenticacaoService.validarUsuario(dto.email, dto.senha);
    const token = this.autenticacaoService.gerarToken(usuario);

    resposta.cookie(NOME_COOKIE, token, obterOpcoesCookie(this.configService));

    return new UsuarioRespostaDto(usuario);
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  logout(@Res({ passthrough: true }) resposta: Response): { mensagem: string } {
    const { maxAge: _maxAge, ...opcoesLimpeza } = obterOpcoesCookie(this.configService);
    resposta.clearCookie(NOME_COOKIE, opcoesLimpeza);
    return { mensagem: 'Logout realizado com sucesso' };
  }

  @UseGuards(GuardaJwt)
  @Get('perfil')
  async perfil(@UsuarioAutenticado() usuarioLogado: PayloadJwt): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.buscarPorId(usuarioLogado.sub);
    return new UsuarioRespostaDto(usuario);
  }
}
