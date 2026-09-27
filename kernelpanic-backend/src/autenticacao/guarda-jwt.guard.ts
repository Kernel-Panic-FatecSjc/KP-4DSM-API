import { ExecutionContext, Injectable } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { AuthGuard } from '@nestjs/passport';
import { CHAVE_ROTA_PUBLICA } from './publico.decorator';

@Injectable()
export class GuardaJwt extends AuthGuard('jwt') {
  constructor(private readonly reflector: Reflector) {
    super();
  }

  handleRequest<TUsuario>(erro: unknown, usuario: TUsuario, info: unknown, context: ExecutionContext): TUsuario {
    const publica = this.reflector.getAllAndOverride<boolean>(CHAVE_ROTA_PUBLICA, [
      context.getHandler(),
      context.getClass(),
    ]);

    if (publica) {
      return (usuario || null) as TUsuario;
    }

    return super.handleRequest(erro, usuario, info, context);
  }
}
