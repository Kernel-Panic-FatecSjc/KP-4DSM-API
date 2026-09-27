import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { APP_GUARD } from '@nestjs/core';
import { ThrottlerGuard, ThrottlerModule } from '@nestjs/throttler';

const JANELA_MS = 60 * 1000;

/**
 * Teto por IP para o login, bem menor que o geral, para dificultar força
 * bruta de senha. Lido de process.env (e não do ConfigService) porque é
 * avaliado dentro do decorator @Throttle, fora da injeção de dependência.
 */
export const LIMITE_LOGIN = {
  default: {
    ttl: JANELA_MS,
    limit: () => Number(process.env.LIMITE_LOGIN_POR_MINUTO ?? 5),
  },
};

// Limite de requisições por IP em toda a API. Existe principalmente por causa
// das rotas públicas (@Publico), que qualquer visitante pode chamar sem login.
// A ingestão das estações fica de fora (@SkipThrottle no controller).
@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (configService: ConfigService) => ({
        errorMessage: 'Muitas requisições. Tente novamente em instantes.',
        throttlers: [
          {
            name: 'default',
            ttl: JANELA_MS,
            limit: Number(configService.get<string>('LIMITE_REQUISICOES_POR_MINUTO', '120')),
          },
        ],
      }),
    }),
  ],
  providers: [{ provide: APP_GUARD, useClass: ThrottlerGuard }],
})
export class LimiteRequisicoesModule {}
