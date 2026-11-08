import { ApiOkResponse, ApiOperation, ApiTags, ApiUnauthorizedResponse } from '@nestjs/swagger';
import { Body, Controller, Get, HttpCode, HttpStatus, Post, Res, UseGuards } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Throttle } from '@nestjs/throttler';
import type { Response } from 'express';
import { UsuariosService } from '../usuarios/usuarios.service';
import { UsuarioRespostaDto } from '../usuarios/dto/usuario-resposta.dto';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { MensagemRespostaDto, RequisicaoInvalida, RotaLogada, RotaPublicaComLimite } from '../documentacao/respostas';
import { LIMITE_LOGIN } from '../limite-requisicoes/limite-requisicoes.module';
import { AutenticacaoService } from './autenticacao.service';
import { obterOpcoesCookie } from './cookie.config';
import { LoginDto } from './dto/login.dto';
import { GuardaJwt } from './guarda-jwt.guard';
import type { UsuarioLogado } from './payload-jwt.interface';
import { UsuarioAutenticado } from './usuario-autenticado.decorator';

const NOME_COOKIE = 'access_token';

@ApiTags('autenticacao')
@Controller('autenticacao')
export class AutenticacaoController {
  constructor(
    private readonly autenticacaoService: AutenticacaoService,
    private readonly usuariosService: UsuariosService,
    private readonly configService: ConfigService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @HttpCode(HttpStatus.OK)
  @Throttle(LIMITE_LOGIN)
  @Post('login')
  @ApiOperation({
    summary: 'Entrar no sistema',
    description: 'Valida email e senha e grava o cookie `access_token` (JWT, HttpOnly). As rotas logadas usam esse cookie. Tem limite próprio de tentativas por minuto.',
  })
  @ApiOkResponse({ type: UsuarioRespostaDto, description: 'Login feito; o cookie de sessão vai no header Set-Cookie.' })
  @RequisicaoInvalida('Email ou senha em formato inválido.')
  @ApiUnauthorizedResponse({ description: 'Credenciais inválidas.' })
  @RotaPublicaComLimite()
  async login(
    @Body() dto: LoginDto,
    @Res({ passthrough: true }) resposta: Response,
  ): Promise<UsuarioRespostaDto> {
    const usuario = await this.autenticacaoService.validarUsuario(dto.email, dto.senha);
    const token = this.autenticacaoService.gerarToken(usuario);

    resposta.cookie(NOME_COOKIE, token, obterOpcoesCookie(this.configService));
    await this.auditoriaService.registrar({
      acao: 'autenticacao.login',
      entidade: 'Autenticacao',
      usuarioId: usuario.id,
      licitacaoId: usuario.licitacaoId,
      detalhes: { email: usuario.email },
    });

    // Com a licitação: o front decide o menu pelo perfil e pelo status dela.
    return new UsuarioRespostaDto(await this.usuariosService.buscarPorId(usuario.id));
  }

  @HttpCode(HttpStatus.OK)
  @Post('logout')
  @ApiOperation({ summary: 'Sair do sistema', description: 'Apaga o cookie de sessão. Funciona mesmo sem sessão ativa.' })
  @ApiOkResponse({ type: MensagemRespostaDto, description: 'Cookie de sessão removido.' })
  @RotaPublicaComLimite()
  logout(@Res({ passthrough: true }) resposta: Response): { mensagem: string } {
    const { maxAge: _maxAge, ...opcoesLimpeza } = obterOpcoesCookie(this.configService);
    resposta.clearCookie(NOME_COOKIE, opcoesLimpeza);
    return { mensagem: 'Logout realizado com sucesso' };
  }

  @UseGuards(GuardaJwt)
  @Get('perfil')
  @RotaLogada()
  @ApiOperation({
    summary: 'Consultar o perfil da sessão',
    description: 'Dados do usuário logado e, em `somenteLeitura`, se a licitação dele deixou de estar vigente.',
  })
  @ApiOkResponse({ type: UsuarioRespostaDto, description: 'Usuário da sessão atual.' })
  async perfil(@UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.buscarPorId(usuarioLogado.sub);
    return new UsuarioRespostaDto(usuario, usuarioLogado.somenteLeitura);
  }
}
