import type { UsuarioLogado } from '../../src/autenticacao/payload-jwt.interface';

// Usuários da requisição (o que a EstrategiaJwt devolve) para os testes unitários.
export const LICITACAO_A = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
export const LICITACAO_B = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

export const TECSUS: UsuarioLogado = {
  sub: 'tecsus-1',
  email: 'tecsus@kp.dev',
  tipo: 'ADMIN_TECSUS',
  licitacaoId: null,
  somenteLeitura: false,
};

export const ADMIN_A: UsuarioLogado = {
  sub: 'admin-a',
  email: 'admin.a@kp.dev',
  tipo: 'ADMIN_LICITACAO',
  licitacaoId: LICITACAO_A,
  somenteLeitura: false,
};

export const USUARIO_A: UsuarioLogado = {
  sub: 'usuario-a',
  email: 'usuario.a@kp.dev',
  tipo: 'USUARIO_LICITACAO',
  licitacaoId: LICITACAO_A,
  somenteLeitura: false,
};

export const ADMIN_B: UsuarioLogado = {
  sub: 'admin-b',
  email: 'admin.b@kp.dev',
  tipo: 'ADMIN_LICITACAO',
  licitacaoId: LICITACAO_B,
  somenteLeitura: false,
};
