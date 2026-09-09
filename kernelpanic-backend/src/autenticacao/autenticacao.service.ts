import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { UsuariosService } from '../usuarios/usuarios.service';
import type { Usuario } from '../generated/prisma/client';
import type { PayloadJwt } from './payload-jwt.interface';

@Injectable()
export class AutenticacaoService {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly jwtService: JwtService,
  ) {}

  async validarUsuario(email: string, senha: string): Promise<Usuario> {
    const usuario = await this.usuariosService.buscarPorEmail(email);
    if (!usuario) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    const senhaValida = await bcrypt.compare(senha, usuario.senhaHash);
    if (!senhaValida) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    if (!usuario.ativo) {
      throw new UnauthorizedException('Credenciais inválidas');
    }

    return usuario;
  }

  gerarToken(usuario: Usuario): string {
    const payload: PayloadJwt = { sub: usuario.id, email: usuario.email };
    return this.jwtService.sign(payload);
  }
}
