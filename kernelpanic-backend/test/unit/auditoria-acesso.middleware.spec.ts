import { EventEmitter } from 'node:events';
import type { NextFunction, Request, Response } from 'express';
import { AuditoriaAcessoMiddleware } from '../../src/auditoria/auditoria-acesso.middleware';
import type { AuditoriaService } from '../../src/auditoria/auditoria.service';

describe('AuditoriaAcessoMiddleware', () => {
  function registrarAcesso(
    path: string,
    statusCode: number,
    usuarioId?: string,
    metodo = 'GET',
    licitacaoId: string | null = null,
  ) {
    const registrar = jest.fn().mockResolvedValue(undefined);
    const middleware = new AuditoriaAcessoMiddleware({ registrar } as unknown as AuditoriaService);
    const request = {
      path,
      originalUrl: path,
      method: metodo,
      ip: '203.0.113.42',
      socket: { remoteAddress: '203.0.113.42' },
      user: usuarioId ? { sub: usuarioId, licitacaoId } : undefined,
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), { statusCode }) as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);
    response.emit('finish');

    return { registrar, next };
  }

  it('registra acessos autorizados com usuário, licitação, IP e status', () => {
    const { registrar, next } = registrarAcesso('/dashboard', 200, 'usuario-1', 'GET', 'licitacao-a');

    expect(next).toHaveBeenCalledTimes(1);
    expect(registrar).toHaveBeenCalledWith({
      acao: 'acesso.http',
      entidade: '/dashboard',
      usuarioId: 'usuario-1',
      licitacaoId: 'licitacao-a',
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

  it('não audita a própria consulta da auditoria (abrir a tela não cria linha nova)', () => {
    for (const caminho of ['/auditoria', '/auditoria?pagina=2&acao=x', '/auditoria/exportar?de=a&ate=b']) {
      const { registrar, next } = registrarAcesso(caminho, 200, 'admin');
      expect(next).toHaveBeenCalledTimes(1);
      expect(registrar).not.toHaveBeenCalled();
    }
  });

  it('continua auditando o que não é GET em /auditoria e rotas que só começam com o mesmo texto', () => {
    expect(registrarAcesso('/auditoria', 404, 'admin', 'POST').registrar).toHaveBeenCalled();
    expect(registrarAcesso('/auditorias', 404, 'admin').registrar).toHaveBeenCalled();
  });

  it('ignora o /saude do monitoramento, que chama de poucos em poucos segundos', () => {
    const { registrar, next } = registrarAcesso('/saude', 200);

    expect(next).toHaveBeenCalledTimes(1);
    expect(registrar).not.toHaveBeenCalled();
  });

  it('ignora o /saude mesmo com o path cortado, como o Express o entrega ao middleware de forRoutes("*")', () => {
    const registrar = jest.fn().mockResolvedValue(undefined);
    const middleware = new AuditoriaAcessoMiddleware({ registrar } as unknown as AuditoriaService);
    const request = {
      path: '/',
      originalUrl: '/saude?origem=monitor',
      method: 'GET',
      ip: '203.0.113.42',
      socket: { remoteAddress: '203.0.113.42' },
    } as unknown as Request;
    const response = Object.assign(new EventEmitter(), { statusCode: 200 }) as Response;
    const next = jest.fn() as NextFunction;

    middleware.use(request, response, next);
    response.emit('finish');

    expect(next).toHaveBeenCalledTimes(1);
    expect(registrar).not.toHaveBeenCalled();
  });
});
