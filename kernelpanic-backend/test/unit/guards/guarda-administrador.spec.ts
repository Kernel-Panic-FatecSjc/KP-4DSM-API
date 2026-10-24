import { ExecutionContext, ForbiddenException, NotFoundException } from '@nestjs/common';
import { GuardaAdministrador } from '../../../src/autenticacao/guarda-administrador.guard';
import type { UsuariosService } from '../../../src/usuarios/usuarios.service';

const usuariosServiceMock = { buscarPorId: jest.fn() };

const contextoCom = (user: { sub: string }) =>
  ({
    switchToHttp: () => ({ getRequest: () => ({ user }) }),
  }) as unknown as ExecutionContext;

describe('GuardaAdministrador', () => {
  const guarda = new GuardaAdministrador(usuariosServiceMock as unknown as UsuariosService);

  beforeEach(() => jest.clearAllMocks());

  it('libera o usuário com perfil ADMINISTRADOR', async () => {
    usuariosServiceMock.buscarPorId.mockResolvedValue({ id: 'a1', tipo: 'ADMINISTRADOR' });

    await expect(guarda.canActivate(contextoCom({ sub: 'a1' }))).resolves.toBe(true);
    expect(usuariosServiceMock.buscarPorId).toHaveBeenCalledWith('a1');
  });

  it('nega (403) o usuário com perfil MONITOR', async () => {
    usuariosServiceMock.buscarPorId.mockResolvedValue({ id: 'm1', tipo: 'MONITOR' });

    await expect(guarda.canActivate(contextoCom({ sub: 'm1' }))).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('não libera quando o usuário da sessão não existe mais', async () => {
    usuariosServiceMock.buscarPorId.mockRejectedValue(new NotFoundException('Usuário não encontrado'));

    await expect(guarda.canActivate(contextoCom({ sub: 'fantasma' }))).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });
});
