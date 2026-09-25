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

  describe('atualizar', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.atualizar('inexistente', { nome: 'Novo' })).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('lança ConflictException quando o novo email já pertence a outro usuário', async () => {
      prismaMock.usuario.findUnique
        .mockResolvedValueOnce({ id: '1', email: 'antigo@a.com' }) // buscarPorId
        .mockResolvedValueOnce({ id: '2', email: 'novo@a.com' }); // email já em uso

      await expect(service.atualizar('1', { email: 'novo@a.com' })).rejects.toBeInstanceOf(
        ConflictException,
      );
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('permite manter o próprio email ao atualizar outros campos', async () => {
      prismaMock.usuario.findUnique
        .mockResolvedValueOnce({ id: '1', email: 'a@a.com' })
        .mockResolvedValueOnce({ id: '1', email: 'a@a.com' });
      prismaMock.usuario.update.mockResolvedValue({ id: '1', email: 'a@a.com', nome: 'Atualizado' });

      await service.atualizar('1', { nome: 'Atualizado', email: 'a@a.com' });

      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { nome: 'Atualizado', email: 'a@a.com', senhaHash: undefined },
      });
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

  describe('ativar', () => {
    it('lança NotFoundException quando o usuário não existe', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue(null);

      await expect(service.ativar('inexistente')).rejects.toBeInstanceOf(NotFoundException);
      expect(prismaMock.usuario.update).not.toHaveBeenCalled();
    });

    it('marca o usuário como ativo novamente', async () => {
      prismaMock.usuario.findUnique.mockResolvedValue({ id: '1', email: 'a@a.com', ativo: false });

      await service.ativar('1');

      expect(prismaMock.usuario.update).toHaveBeenCalledWith({
        where: { id: '1' },
        data: { ativo: true },
      });
    });
  });
});
