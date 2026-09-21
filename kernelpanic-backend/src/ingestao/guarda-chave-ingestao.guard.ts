import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';

export const HEADER_CHAVE_INGESTAO = 'x-chave-estacao';

@Injectable()
export class GuardaChaveIngestao implements CanActivate {
  private readonly logger = new Logger(GuardaChaveIngestao.name);

  constructor(private readonly configService: ConfigService) {}

  canActivate(context: ExecutionContext): boolean {
    const chaveEsperada = this.configService.get<string>('INGESTAO_CHAVE_API');

    if (!chaveEsperada) {
      this.logger.warn('INGESTAO_CHAVE_API não configurada: a rota de ingestão está sem autenticação.');
      return true;
    }

    const request = context.switchToHttp().getRequest<Request>();
    const chaveRecebida = request.headers[HEADER_CHAVE_INGESTAO];

    if (chaveRecebida !== chaveEsperada) {
      throw new UnauthorizedException('Chave de ingestão inválida');
    }

    return true;
  }
}
