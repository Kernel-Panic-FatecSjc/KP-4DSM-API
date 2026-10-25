import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { Request } from 'express';
import type { TipoUsuario } from '../generated/prisma/client';
import { CHAVE_PERFIS } from './perfis.decorator';
import type { UsuarioLogado } from './payload-jwt.interface';

const METODOS_DE_LEITURA = ['GET', 'HEAD', 'OPTIONS'];

/**
 * Roda depois da GuardaJwt. Confere o perfil exigido por @Perfis e barra toda
 * escrita (método que não é de leitura) de usuário de licitação que não está
 * vigente: a licitação encerrada continua consultável, mas só para leitura.
 */
@Injectable()
export class GuardaPerfil implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext): boolean {
    const perfis = this.reflector.getAllAndOverride<TipoUsuario[] | undefined>(CHAVE_PERFIS, [
      context.getHandler(),
      context.getClass(),
    ]);
    const request = context.switchToHttp().getRequest<Request & { user?: UsuarioLogado | null }>();
    const usuario = request.user;

    // Rota @Publico sem sessão: quem decide o que o visitante vê é o serviço.
    if (!usuario) {
      if (perfis) throw new UnauthorizedException();
      return true;
    }

    if (perfis && !perfis.includes(usuario.tipo)) {
      throw new ForbiddenException('Seu perfil não tem acesso a esta ação');
    }

    if (usuario.somenteLeitura && !METODOS_DE_LEITURA.includes(request.method)) {
      throw new ForbiddenException('A licitação não está vigente: o acesso é somente leitura');
    }

    return true;
  }
}
