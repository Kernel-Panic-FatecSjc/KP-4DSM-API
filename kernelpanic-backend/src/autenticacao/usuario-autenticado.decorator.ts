import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { PayloadJwt } from './payload-jwt.interface';

export const UsuarioAutenticado = createParamDecorator((_data: unknown, ctx: ExecutionContext): PayloadJwt => {
  const request = ctx.switchToHttp().getRequest<Request & { user: PayloadJwt }>();
  return request.user;
});
