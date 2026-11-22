import { SetMetadata } from '@nestjs/common';
import { TipoUsuario } from '../generated/prisma/client';

export const CHAVE_PERFIS = 'perfis';

/** Perfis que podem chamar a rota (ou todas as do controller). Lido pela GuardaPerfil. */
export const Perfis = (...perfis: TipoUsuario[]) => SetMetadata(CHAVE_PERFIS, perfis);

/** Os dois perfis que cadastram: a Tecsus em qualquer licitação, o admin só na dele. */
export const PERFIS_ADMIN = [TipoUsuario.ADMIN_TECSUS, TipoUsuario.ADMIN_LICITACAO];
