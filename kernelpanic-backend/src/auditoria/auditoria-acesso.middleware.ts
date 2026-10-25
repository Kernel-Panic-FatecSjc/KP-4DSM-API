import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import { AuditoriaService } from './auditoria.service';

type RequisicaoComUsuario = Request & {
  user?: { id?: string; sub?: string; licitacaoId?: string | null };
};

// /saude: o monitoramento chama de poucos em poucos segundos. GET /auditoria:
// consultar a trilha não pode criar linha nova nela (a tela recarregaria a
// lista e veria a própria consulta no topo).
const ROTAS_SEM_AUDITORIA: { metodo?: string; prefixo: string }[] = [
  { prefixo: '/saude' },
  { metodo: 'GET', prefixo: '/auditoria' },
];

function semAuditoria(metodo: string, url: string): boolean {
  const caminho = url.split('?')[0];
  return ROTAS_SEM_AUDITORIA.some(
    (rota) =>
      (!rota.metodo || rota.metodo === metodo) &&
      (caminho === rota.prefixo || caminho.startsWith(`${rota.prefixo}/`)),
  );
}

@Injectable()
export class AuditoriaAcessoMiddleware implements NestMiddleware {
  private readonly logger = new Logger(AuditoriaAcessoMiddleware.name);

  constructor(private readonly auditoriaService: AuditoriaService) {}

  use(request: RequisicaoComUsuario, response: Response, next: NextFunction): void {
    // originalUrl, e não path: com forRoutes('*') o Express corta o prefixo que
    // casou, então request.path chega aqui como '/' e este desvio nunca disparava.
    if (semAuditoria(request.method, request.originalUrl)) {
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
        licitacaoId: request.user?.licitacaoId ?? null,
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