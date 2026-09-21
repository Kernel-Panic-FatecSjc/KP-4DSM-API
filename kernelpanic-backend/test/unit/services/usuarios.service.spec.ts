import { ConflictException, NotFoundException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../../../src/prisma/prisma.service';
import { UsuariosService } from '../../../src/usuarios/usuarios.service';

describe('UsuariosService', () => {
  let service: UsuariosService;
  const prismaMock = {
    usuario: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [UsuariosService, { provide: PrismaService, useValue: prismaMock }],
    }).compile();

    service = module.get(UsuariosService);
  });

  describe('criar', () => {
    it('cria um usuário com a senha hasheada quando o email não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);
      prismaMock.usuario.create.mockImplementation(({ data }) => ({ id: '1', ...data }));

      const usuario = await service.criar({ nome: 'Fulano', email: 'a@a.com', senha: 'senha12345' });

      expect(usuario.senhaHash).not.toBe('senha12345');
      expect(await bcrypt.compare('senha12345', usuario.senhaHash)).toBe(true);
    });

    it('lança ConflictException quando o email já existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com' });

      await expect(
        service.criar({ nome: 'Fulano', email: 'a@a.com', senha: 'senha12345' }),
      ).rejects.toBeInstanceOf(ConflictException);
      expect(prismaMock.usuario.create).not.toHaveBeenCalled();
    });
  });

  describe('buscarPorId', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.buscarPorId('inexistente')).rejects.toBeInstanceOf(NotFoundException);
    });

    it('retorna o usuário quando ele existe', async () => {
      const usuario = { id: '1', email: 'a@a.com' };
      prismaMock.usuario.findUnique.mockResolvedValue(usuario);

      await expect(service.buscarPorId('1')).resolves.toEqual(usuario);
    });
  });

  describe('inativar', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.inativar('inexistente')).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('marca o usuário como inativo em vez de apagá-lo', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com', ativo: true });

      await service.inativar('1');

      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { ativo: false },
      });
    });
  });
});
