import { CanActivate, ExecutionContext, Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Request } from 'express';
import { chaveIngestaoConfere } from '../../../src/estacoes/chave-ingestao';
import { PrismaService } from '../../../src/prisma/prisma.service';

export const HEADER_CHAVE_INGESTAO = 'x-chave-estacao';

// Únicos ambientes em que a rota de ingestão pode ficar sem chave.
const AMBIENTES_COM_ROTA_ABERTA = ['development', 'test'];

/**
 * Só a própria estação envia dados em seu nome: a chave do header precisa
 * bater com o hash guardado na estação do vid da requisição (na URL, na
 * consulta de parâmetros, ou no corpo, na telemetria).
 */
@Injectable()
export class GuardaChaveIngestao implements CanActivate {
  private readonly logger = new Logger(GuardaChaveIngestao.name);
  private readonly rotaAberta: boolean;

  constructor(
    private readonly prisma: PrismaService,
    configService: ConfigService,
  ) {
    this.rotaAberta = configService.get<string>('INGESTAO_ROTA_ABERTA') === 'true';
    const ambiente = configService.get<string>('NODE_ENV') ?? '';

    // Lançar aqui impede a API de subir: fora de desenvolvimento a rota não
    // fica aberta nem por engano de configuração.
    if (this.rotaAberta && !AMBIENTES_COM_ROTA_ABERTA.includes(ambiente)) {
      throw new Error(
        `INGESTAO_ROTA_ABERTA=true só é permitido com NODE_ENV ${AMBIENTES_COM_ROTA_ABERTA.join(' ou ')} (atual: "${ambiente}")`,
      );
    }
    if (this.rotaAberta) {
      this.logger.warn('INGESTAO_ROTA_ABERTA=true: a rota de ingestão está sem autenticação.');
    }
  }

  async canActivate(context: ExecutionContext): Promise<boolean> {
    if (this.rotaAberta) return true;

    const request = context.switchToHttp().getRequest<Request>();
    const chave = request.headers[HEADER_CHAVE_INGESTAO];
    // Na URL primeiro: o body-parser também lê corpo em GET, e um vid no
    // corpo não pode trocar a estação que a rota de parâmetros consulta.
    const vid: unknown = request.params?.vid ?? request.body?.vid;

    if (typeof chave !== 'string' || typeof vid !== 'string') {
      throw new UnauthorizedException('Chave de ingestão inválida');
    }

    const estacao = await this.prisma.estacao.findUnique({
      where: { vid },
      select: { chaveIngestaoHash: true },
    });

    // Estação inexistente e chave errada dão a mesma resposta, para a rota
    // não revelar quais vids estão cadastrados.
    if (!estacao?.chaveIngestaoHash || !chaveIngestaoConfere(chave, estacao.chaveIngestaoHash)) {
      throw new UnauthorizedException('Chave de ingestão inválida');
    }

    return true;
  }
}
