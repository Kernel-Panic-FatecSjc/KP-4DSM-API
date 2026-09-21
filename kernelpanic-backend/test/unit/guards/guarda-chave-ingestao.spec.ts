import { ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  GuardaChaveIngestao,
  HEADER_CHAVE_INGESTAO,
} from '../../../src/ingestao/guarda-chave-ingestao.guard';

const contextoCom = (headers: Record<string, string>) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ headers }) }),
  }) as unknown as ExecutionContext;

const guardaCom = (chave?: string) =>
  new GuardaChaveIngestao({ get: () => chave } as unknown as ConfigService);

describe('GuardaChaveIngestao', () => {
  it('libera a rota quando INGESTAO_CHAVE_API não está configurada', () => {
    expect(guardaCom(undefined).canActivate(contextoCom({}))).toBe(true);
  });

  it('aceita a requisição com a chave correta no header', () => {
    const contexto = contextoCom({ [HEADER_CHAVE_INGESTAO]: 'segredo' });
    expect(guardaCom('segredo').canActivate(contexto)).toBe(true);
  });

  it('recusa a requisição com chave errada ou ausente', () => {
    expect(() => guardaCom('segredo').canActivate(contextoCom({}))).toThrow(UnauthorizedException);
    expect(() =>
      guardaCom('segredo').canActivate(contextoCom({ [HEADER_CHAVE_INGESTAO]: 'errada' })),
    ).toThrow(UnauthorizedException);
  });
});
