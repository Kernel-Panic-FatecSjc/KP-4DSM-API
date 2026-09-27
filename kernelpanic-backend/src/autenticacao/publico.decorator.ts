import { SetMetadata } from '@nestjs/common';

export const CHAVE_ROTA_PUBLICA = 'rotaPublica';

/**
 * Libera a rota para visitantes sem login. O GuardaJwt ainda tenta ler o
 * cookie: se houver sessão válida, `request.user` é preenchido normalmente;
 * caso contrário, fica `null` em vez de responder 401.
 */
export const Publico = () => SetMetadata(CHAVE_ROTA_PUBLICA, true);
