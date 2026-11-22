import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { UsuarioLogado } from './payload-jwt.interface';

export const UsuarioAutenticado = createParamDecorator((_data: unknown, ctx: ExecutionContext): UsuarioLogado => {
  const request = ctx.switchToHttp().getRequest<Request & { user: UsuarioLogado }>();
  return request.user;
});
