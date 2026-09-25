import { describe, expect, it } from 'vitest';
import type { Usuario } from './api';
import { podeInativarUsuario } from './permissoes-usuario';

function criarUsuario(sobrescritas: Partial<Usuario> = {}): Usuario {
  return {
    id: '1',
    nome: 'Fulano',
    email: 'fulano@a.com',
    tipo: 'MONITOR',
    ativo: true,
    criadoEm: '',
    atualizadoEm: '',
    ...sobrescritas,
  };
}

describe('podeInativarUsuario', () => {
  it('não permite que o usuário logado inative a si mesmo', () => {
    const usuario = criarUsuario({ id: 'meu-id' });

    expect(podeInativarUsuario(usuario, 'meu-id')).toBe(false);
  });

  it('permite inativar outro usuário ativo', () => {
    const usuario = criarUsuario({ id: 'outro-id' });

    expect(podeInativarUsuario(usuario, 'meu-id')).toBe(true);
  });

  it('não permite inativar um usuário já inativo', () => {
    const usuario = criarUsuario({ id: 'outro-id', ativo: false });

    expect(podeInativarUsuario(usuario, 'meu-id')).toBe(false);
  });

  it('permite inativar outros quando não há usuário logado identificado', () => {
    const usuario = criarUsuario({ id: 'outro-id' });

    expect(podeInativarUsuario(usuario, null)).toBe(true);
  });
});
