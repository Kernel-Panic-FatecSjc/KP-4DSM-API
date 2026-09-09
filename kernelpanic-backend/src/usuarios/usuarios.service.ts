import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import type { Usuario } from '../generated/prisma/client';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';

const SALT_ROUNDS = 10;

@Injectable()
export class UsuariosService {
  constructor(private readonly prisma: PrismaService) {}

  async criar(dto: CriarUsuarioDto): Promise<Usuario> {
    const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
    if (existente) {
      throw new ConflictException('Já existe um usuário com este email');
    }

    const senhaHash = await bcrypt.hash(dto.senha, SALT_ROUNDS);
    return this.prisma.usuario.create({
      data: { nome: dto.nome, email: dto.email, senhaHash },
    });
  }

  async buscarTodos(): Promise<Usuario[]> {
    return this.prisma.usuario.findMany({ orderBy: { criadoEm: 'asc' } });
  }

  async buscarPorId(id: string): Promise<Usuario> {
    const usuario = await this.prisma.usuario.findUnique({ where: { id } });
    if (!usuario) {
      throw new NotFoundException('Usuário não encontrado');
    }
    return usuario;
  }

  async buscarPorEmail(email: string): Promise<Usuario | null> {
    return this.prisma.usuario.findUnique({ where: { email } });
  }

  async atualizar(id: string, dto: AtualizarUsuarioDto): Promise<Usuario> {
    await this.buscarPorId(id);

    if (dto.email) {
      const existente = await this.prisma.usuario.findUnique({ where: { email: dto.email } });
      if (existente && existente.id !== id) {
        throw new ConflictException('Já existe um usuário com este email');
      }
    }

    return this.prisma.usuario.update({
      where: { id },
      data: {
        nome: dto.nome,
        email: dto.email,
        senhaHash: dto.senha ? await bcrypt.hash(dto.senha, SALT_ROUNDS) : undefined,
      },
    });
  }

  async inativar(id: string): Promise<void> {
    await this.buscarPorId(id);
    await this.prisma.usuario.update({ where: { id }, data: { ativo: false } });
  }
}
