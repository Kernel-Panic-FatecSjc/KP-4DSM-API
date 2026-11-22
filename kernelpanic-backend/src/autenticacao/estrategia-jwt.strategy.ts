import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { PayloadJwt, UsuarioLogado } from './payload-jwt.interface';

function extrairTokenDoCookie(request: Request): string | null {
  return request?.cookies?.access_token ?? null;
}

@Injectable()
export class EstrategiaJwt extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    configService: ConfigService,
    private readonly usuariosService: UsuariosService,
  ) {
    super({
      jwtFromRequest: extrairTokenDoCookie,
      ignoreExpiration: false,
      secretOrKey: configService.getOrThrow<string>('JWT_SECRET'),
    });
  }

  // Perfil, licitação e status vêm do banco a cada requisição: trocar o perfil
  // de alguém ou encerrar a licitação vale na hora, sem esperar o token vencer.
  async validate(payload: PayloadJwt): Promise<UsuarioLogado> {
    const usuario = await this.usuariosService.buscarParaSessao(payload.sub);

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Sessão inválida');
    }

    return {
      sub: usuario.id,
      email: usuario.email,
      tipo: usuario.tipo,
      licitacaoId: usuario.licitacaoId,
      somenteLeitura: usuario.licitacao !== null && usuario.licitacao.status !== 'VIGENTE',
    };
  }
}
