import type { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

const UNIDADES_EM_MS: Record<string, number> = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
};

export function converterDuracaoParaMs(duracao: string): number {
  const combinacao = /^(\d+)(s|m|h|d)$/.exec(duracao.trim());
  if (!combinacao) {
    throw new Error(`Formato de duração inválido: "${duracao}" (use algo como "1h", "15m", "7d")`);
  }
  const [, quantidade, unidade] = combinacao;
  return Number(quantidade) * UNIDADES_EM_MS[unidade];
}

export function obterOpcoesCookie(configService: ConfigService): CookieOptions {
  const sameSite = configService.get<string>('COOKIE_SAMESITE', 'lax') as CookieOptions['sameSite'];
  return {
    httpOnly: true,
    secure: configService.get<string>('COOKIE_SECURE', 'false') === 'true',
    sameSite,
    path: '/',
    maxAge: converterDuracaoParaMs(configService.get<string>('JWT_EXPIRES_IN', '1h')),
  };
}
