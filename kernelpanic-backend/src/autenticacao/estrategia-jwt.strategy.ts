import { Injectable, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PassportStrategy } from '@nestjs/passport';
import type { Request } from 'express';
import { Strategy } from 'passport-jwt';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { PayloadJwt } from './payload-jwt.interface';

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

  async validate(payload: PayloadJwt): Promise<PayloadJwt> {
    const usuario = await this.usuariosService.buscarPorId(payload.sub).catch(() => null);

    if (!usuario || !usuario.ativo) {
      throw new UnauthorizedException('Sessão inválida');
    }

    return { sub: usuario.id, email: usuario.email };
  }
}
