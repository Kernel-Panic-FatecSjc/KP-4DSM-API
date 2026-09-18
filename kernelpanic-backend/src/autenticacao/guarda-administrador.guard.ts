import { CanActivate, ExecutionContext, ForbiddenException, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { PayloadJwt } from './payload-jwt.interface';

@Injectable()
export class GuardaAdministrador implements CanActivate {
  constructor(private readonly usuariosService: UsuariosService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest<Request & { user: PayloadJwt }>();
    const usuario = await this.usuariosService.buscarPorId(request.user.sub);

    if (usuario.tipo !== 'ADMINISTRADOR') {
      throw new ForbiddenException('Acesso restrito ao administrador');
    }

    return true;
  }
}