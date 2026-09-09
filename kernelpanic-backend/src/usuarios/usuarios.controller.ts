import { Body, Controller, Delete, Get, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { UsuarioRespostaDto } from './dto/usuario-resposta.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(GuardaJwt)
export class UsuariosController {
  constructor(private readonly usuariosService: UsuariosService) {}

  @Post()
  async criar(@Body() dto: CriarUsuarioDto): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.criar(dto);
    return new UsuarioRespostaDto(usuario);
  }

  @Get()
  async buscarTodos(): Promise<UsuarioRespostaDto[]> {
    const usuarios = await this.usuariosService.buscarTodos();
    return usuarios.map((usuario) => new UsuarioRespostaDto(usuario));
  }

  @Get(':id')
  async buscarPorId(@Param('id') id: string): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.buscarPorId(id);
    return new UsuarioRespostaDto(usuario);
  }

  @Patch(':id')
  async atualizar(@Param('id') id: string, @Body() dto: AtualizarUsuarioDto): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.atualizar(id, dto);
    return new UsuarioRespostaDto(usuario);
  }

  @Delete(':id')
  async inativar(@Param('id') id: string): Promise<{ mensagem: string }> {
    await this.usuariosService.inativar(id);
    return { mensagem: 'Usuário inativado com sucesso' };
  }
}
