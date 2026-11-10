import { applyDecorators } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiForbiddenResponse,
  ApiNotFoundResponse,
  ApiProperty,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';

/** Nome do esquema do cookie JWT, declarado em configurar-app.ts. */
export const ESQUEMA_COOKIE = 'access_token';

const LIMITE = 'Limite de requisições por IP excedido.';

/** Rota que exige sessão: cookie JWT, 401 e 429 (o limite vale para toda a API). */
export const RotaLogada = () =>
  applyDecorators(
    ApiCookieAuth(ESQUEMA_COOKIE),
    ApiUnauthorizedResponse({ description: 'Cookie de sessão ausente, inválido ou expirado.' }),
    ApiTooManyRequestsResponse({ description: LIMITE }),
  );

/** Rota @Publico() com sessão opcional: só o 429. */
export const RotaPublicaComLimite = () => ApiTooManyRequestsResponse({ description: LIMITE });

export const Proibido = (descricao: string) => ApiForbiddenResponse({ description: descricao });
export const NaoEncontrado = (descricao: string) => ApiNotFoundResponse({ description: descricao });
export const Conflito = (descricao: string) => ApiConflictResponse({ description: descricao });
export const RequisicaoInvalida = (descricao: string) => ApiBadRequestResponse({ description: descricao });

/** Resposta padrão das rotas que só confirmam a ação. */
export class MensagemRespostaDto {
  @ApiProperty({ example: 'Operação realizada com sucesso', description: 'Confirmação em texto.' })
  mensagem!: string;
}
