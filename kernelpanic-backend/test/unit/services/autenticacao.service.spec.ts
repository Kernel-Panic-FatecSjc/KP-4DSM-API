import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from '../../../src/usuarios/usuarios.service';
import { AutenticacaoService } from '../../../src/autenticacao/autenticacao.service';

describe('AutenticacaoService', () => {
  let service: AutenticacaoService;
  const usuariosServiceMock = { buscarPorEmail: jest.fn() };
  const jwtServiceMock = { sign: jest.fn() };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AutenticacaoService,
        { provide: UsuariosService, useValue: usuariosServiceMock },
        { provide: JwtService, useValue: jwtServiceMock },
      ],
    }).compile();

    service = module.get(AutenticacaoService);
  });

  describe('validarUsuario', () => {
    it('lança UnauthorizedException quando o usuário não existe', async () => {
      usuariosServiceMock.buscarPorEmail.mockResolvedValue(null);

      await expect(service.validarUsuario('a@a.com', 'senha')).rejects.toBeInstanceOf(UnauthorizedException);
    });

    it('lança UnauthorizedException quando a senha está incorreta', async () => {
      const senhaHash = await bcrypt.hash('senhaCorreta', 10);
      usuariosServiceMock.buscarPorEmail.mockResolvedValue({ id: '1', email: 'a@a.com', senhaHash });

      await expect(service.validarUsuario('a@a.com', 'senhaErrada')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('lança UnauthorizedException quando o usuário está inativo', async () => {
      const senhaHash = await bcrypt.hash('senhaCorreta', 10);
      usuariosServiceMock.buscarPorEmail.mockResolvedValue({
        id: '1',
        email: 'a@a.com',
        senhaHash,
        ativo: false,
      });

      await expect(service.validarUsuario('a@a.com', 'senhaCorreta')).rejects.toBeInstanceOf(
        UnauthorizedException,
      );
    });

    it('retorna o usuário quando as credenciais estão corretas e ele está ativo', async () => {
      const senhaHash = await bcrypt.hash('senhaCorreta', 10);
      const usuario = { id: '1', email: 'a@a.com', senhaHash, ativo: true };
      usuariosServiceMock.buscarPorEmail.mockResolvedValue(usuario);

      await expect(service.validarUsuario('a@a.com', 'senhaCorreta')).resolves.toEqual(usuario);
    });
  });

  describe('gerarToken', () => {
    it('assina um token com o id e o email do usuário', () => {
      jwtServiceMock.sign.mockReturnValue('token-assinado');

      const token = service.gerarToken({ id: '1', email: 'a@a.com' } as any);

      expect(token).toBe('token-assinado');
      expect(jwtServiceMock.sign).toHaveBeenCalledWith({ sub: '1', email: 'a@a.com' });
    });
  });
});
