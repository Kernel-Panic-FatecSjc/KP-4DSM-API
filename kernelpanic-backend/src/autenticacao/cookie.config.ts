import type { ConfigService } from '@nestjs/config';
import type { CookieOptions } from 'express';

type UnidadeDuracao = 's' | 'm' | 'h' | 'd';

const UNIDADES_EM_MS = {
  s: 1000,
  m: 60 * 1000,
  h: 60 * 60 * 1000,
  d: 24 * 60 * 60 * 1000,
} as const satisfies Record<UnidadeDuracao, number>;

const PADRAO_DURACAO = new RegExp(`^(\\d+)(${Object.keys(UNIDADES_EM_MS).join('|')})$`);

const VALORES_SAMESITE = ['lax', 'strict', 'none'] as const;
type ValorSameSite = (typeof VALORES_SAMESITE)[number];

export function converterDuracaoParaMs(duracao: string): number {
  const combinacao = PADRAO_DURACAO.exec(duracao.trim());
  if (!combinacao) {
    throw new Error(`Formato de duração inválido: "${duracao}" (use algo como "1h", "15m", "7d")`);
  }
  const [, quantidade, unidade] = combinacao;
  return Number(quantidade) * UNIDADES_EM_MS[unidade as UnidadeDuracao];
}

export function converterSameSite(valor: string): ValorSameSite {
  const normalizado = valor.trim().toLowerCase();
  if (!VALORES_SAMESITE.includes(normalizado as ValorSameSite)) {
    throw new Error(
      `COOKIE_SAMESITE inválido: "${valor}" (use ${VALORES_SAMESITE.join(', ')})`,
    );
  }
  return normalizado as ValorSameSite;
}

export function obterOpcoesCookie(configService: ConfigService): CookieOptions {
  return {
    httpOnly: true,
    secure: configService.get<string>('COOKIE_SECURE', 'false') === 'true',
    sameSite: converterSameSite(configService.get<string>('COOKIE_SAMESITE', 'lax')),
    path: '/',
    maxAge: converterDuracaoParaMs(configService.get<string>('JWT_EXPIRES_IN', '1h')),
  };
}
