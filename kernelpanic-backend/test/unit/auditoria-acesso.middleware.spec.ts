import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { AuditoriaAcessoMiddleware } from '../../src/auditoria/auditoria-acesso.middleware';
import type { AuditoriaService } from '../../src/auditoria/auditoria.service';

describe('AuditoriaAcessoMiddleware', () => {
  function registrarAcesso(path: string, statusCode: number, usuarioId?: string) {
    const registrar = jest.fn().mockResolvedValue(undefined);
    const middleware = new AuditoriaAcessoMiddleware({ registrar } as unknown as AuditoriaService);
    const request = {
      path,
      method: 'GET',
      ip: '203.0.113.42',
      socket: { remoteAddress: '203.0.113.42' },
      user: usuarioId ? { sub: usuarioId } : undefined,
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), { statusCode }) as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);
    response.emit('finish');

    return { registrar, next };
  }

  it('registra acessos autorizados com usuário, IP e status', () => {
    const { registrar, next } = registrarAcesso('/dashboard', 200, 'usuario-1');

    expect(next).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledWith({
      acao: 'acesso.http',
      entidade: '/dashboard',
      usuarioId: 'usuario-1',
      enderecoIp: '203.0.113.42',
      detalhes: { metodo: 'GET', status: 200, autenticado: true },
    });
  });

  it('registra tentativas negadas sem sessão', () => {
    const { registrar } = registrarAcesso('/autenticacao/perfil', 401);

    expect(registrar).toHaveBeenCalledWith(expect.objectContaining({
      acao: 'acesso.http',
      entidade: '/autenticacao/perfil',
      enderecoIp: '203.0.113.42',
      detalhes: { metodo: 'GET', status: 401, autenticado: false },
    }));
  });

  it('ignora o tráfego frequente da ingestão ESP32', () => {
    const { registrar, next } = registrarAcesso('/ingestao/telemetria', 201);

    expect(next).toHaveBeenCalledTimes(1);
    expect(registrar).not.toHaveBeenCalled();
  });
});