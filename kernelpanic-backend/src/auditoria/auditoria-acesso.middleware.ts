import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuditoriaService } from './auditoria.service';

type RequisicaoComUsuario = Request & {
  user?: { id?: string; sub?: string };
};

@Injectable()
export class AuditoriaAcessoMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditoriaAcessoMiddleware.name);

  constructor(private readonly auditoriaService: AuditoriaService) {}

  use(request: RequisicaoComUsuario, response: Response, next: NextFunction): void {
    if (request.path.startsWith('/ingestao')) {
      next();
      return;
    }

    response.once('finish', () => {
      // 400 é erro de validação de entrada, não evento de acesso (não há
      // "quem tentou acessar o quê" aqui) — cada rota já decide por conta
      // própria se audita a ação de negócio. 401/403 continuam sendo
      // registrados: são tentativas de acesso reais, negadas.
      if (response.statusCode === 400) return;

      const usuarioId = request.user?.sub ?? request.user?.id;
      void this.auditoriaService.registrar({
        acao: 'acesso.http',
        entidade: request.path,
        usuarioId,
        enderecoIp: request.ip ?? request.socket.remoteAddress,
        detalhes: {
          metodo: request.method,
          status: response.statusCode,
          autenticado: Boolean(usuarioId),
        },
      }).catch((erro: unknown) => {
        this.logger.error('Não foi possível registrar o acesso na auditoria', erro);
      });
    });

    next();
  }
}