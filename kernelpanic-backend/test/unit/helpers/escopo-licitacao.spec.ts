import { ForbiddenException } from '@nestjs/common';
import { garantirAcessoLicitacao, licitacaoDoEscopo } from '../../../src/autenticacao/escopo-licitacao';
import { ADMIN_A, LICITACAO_A, LICITACAO_B, TECSUS, USUARIO_A } from '../sessoes';

describe('escopo de licitação', () => {
  it('a Tecsus vê todas (undefined) ou a que escolher', () => {
    expect(licitacaoDoEscopo(TECSUS)).toBeUndefined();
    expect(licitacaoDoEscopo(TECSUS, LICITACAO_B)).toBe(LICITACAO_B);
  });

  it('o usuário de licitação fica preso à dele, informando ou não', () => {
    expect(licitacaoDoEscopo(USUARIO_A)).toBe(LICITACAO_A);
    expect(licitacaoDoEscopo(ADMIN_A, LICITACAO_A)).toBe(LICITACAO_A);
  });

  it('pedir outra licitação é 403, nunca a lista dela', () => {
    expect(() => licitacaoDoEscopo(USUARIO_A, LICITACAO_B)).toThrow(ForbiddenException);
  });

  it('registro de outra licitação é 403; a Tecsus acessa qualquer um', () => {
    expect(() => garantirAcessoLicitacao(ADMIN_A, LICITACAO_B)).toThrow(ForbiddenException);
    expect(() => garantirAcessoLicitacao(ADMIN_A, null)).toThrow(ForbiddenException);
    expect(() => garantirAcessoLicitacao(ADMIN_A, LICITACAO_A)).not.toThrow();
    expect(() => garantirAcessoLicitacao(TECSUS, LICITACAO_B)).not.toThrow();
  });
});
