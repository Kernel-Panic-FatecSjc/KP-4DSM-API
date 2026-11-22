import { ExecutionContext, ForbiddenException, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { GuardaPerfil } from '../../../src/autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../../../src/autenticacao/payload-jwt.interface';
import { ADMIN_A, TECSUS, USUARIO_A } from '../sessoes';

function contexto(metodo: string, usuario: UsuarioLogado | null): ExecutionContext {
  return {
    getHandler: () => undefined,
    getClass: () => undefined,
    switchToHttp: () => ({ getRequest: () => ({ method: metodo, user: usuario }) }),
  } as unknown as ExecutionContext;
}

function guarda(perfis?: string[]): GuardaPerfil {
  const reflector = { getAllAndOverride: () => perfis } as unknown as Reflector;
  return new GuardaPerfil(reflector);
}

describe('GuardaPerfil', () => {
  it('deixa passar o perfil listado em @Perfis e barra os outros', () => {
    const soAdmins = guarda(['ADMIN_TECSUS', 'ADMIN_LICITACAO']);

    expect(soAdmins.canActivate(contexto('POST', TECSUS))).toBe(true);
    expect(soAdmins.canActivate(contexto('POST', ADMIN_A))).toBe(true);
    expect(() => soAdmins.canActivate(contexto('POST', USUARIO_A))).toThrow(ForbiddenException);
  });

  it('sem @Perfis, qualquer usuário logado passa', () => {
    expect(guarda().canActivate(contexto('PATCH', USUARIO_A))).toBe(true);
  });

  it('licitação não vigente: lê, mas não escreve, em nenhuma rota', () => {
    const somenteLeitura = { ...ADMIN_A, somenteLeitura: true };

    for (const metodo of ['GET', 'HEAD']) {
      expect(guarda(['ADMIN_LICITACAO']).canActivate(contexto(metodo, somenteLeitura))).toBe(true);
    }
    for (const metodo of ['POST', 'PATCH', 'PUT', 'DELETE']) {
      expect(() => guarda().canActivate(contexto(metodo, somenteLeitura))).toThrow(/somente leitura/);
    }
  });

  it('rota pública sem sessão passa, mas rota com perfil exigido não', () => {
    expect(guarda().canActivate(contexto('GET', null))).toBe(true);
    expect(() => guarda(['ADMIN_TECSUS']).canActivate(contexto('GET', null))).toThrow(UnauthorizedException);
  });
});
