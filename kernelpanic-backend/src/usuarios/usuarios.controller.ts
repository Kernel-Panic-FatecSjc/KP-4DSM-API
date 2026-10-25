import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { camposInformados } from '../auditoria/campos-informados';
import { AtualizarUsuarioDto } from './dto/atualizar-usuario.dto';
import { BuscarUsuariosQueryDto } from './dto/buscar-usuarios-query.dto';
import { CriarUsuarioDto } from './dto/criar-usuario.dto';
import { UsuarioRespostaDto } from './dto/usuario-resposta.dto';
import { UsuariosService } from './usuarios.service';

@Controller('usuarios')
@UseGuards(GuardaJwt, GuardaPerfil)
export class UsuariosController {
  constructor(
    private readonly usuariosService: UsuariosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Post()
  @Perfis(...PERFIS_ADMIN)
  async criar(@Body() dto: CriarUsuarioDto, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.criar(dto, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.criar',
      entidade: 'Usuario',
      entidadeId: usuario.id,
      ...autoria(usuarioLogado),
      detalhes: { email: dto.email, nome: dto.nome, tipo: usuario.tipo, licitacaoId: usuario.licitacaoId },
    });
    return new UsuarioRespostaDto(usuario);
  }

  @Get()
  @Perfis(...PERFIS_ADMIN)
  async buscarTodos(
    @Query() query: BuscarUsuariosQueryDto,
    @UsuarioAutenticado() usuarioLogado: UsuarioLogado,
  ): Promise<UsuarioRespostaDto[]> {
    const usuarios = await this.usuariosService.buscarTodos(query, usuarioLogado);
    return usuarios.map((usuario) => new UsuarioRespostaDto(usuario));
  }

  @Get(':id')
  async buscarPorId(@Param('id') id: string, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.buscarVisivel(id, usuarioLogado);
    return new UsuarioRespostaDto(usuario);
  }

  @Patch(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarUsuarioDto,
    @UsuarioAutenticado() usuarioLogado: UsuarioLogado,
  ): Promise<UsuarioRespostaDto> {
    const usuario = await this.usuariosService.atualizar(id, dto, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.atualizar',
      entidade: 'Usuario',
      entidadeId: id,
      ...autoria(usuarioLogado),
      detalhes: { campos: camposInformados(dto) },
    });
    return new UsuarioRespostaDto(usuario);
  }

  @Delete(':id')
  @Perfis(...PERFIS_ADMIN)
  async inativar(@Param('id') id: string, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<{ mensagem: string }> {
    await this.usuariosService.inativar(id, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.inativar',
      entidade: 'Usuario',
      entidadeId: id,
      ...autoria(usuarioLogado),
    });
    return { mensagem: 'Usuário inativado com sucesso' };
  }

  @Patch(':id/ativar')
  @Perfis(...PERFIS_ADMIN)
  async ativar(@Param('id') id: string, @UsuarioAutenticado() usuarioLogado: UsuarioLogado): Promise<{ mensagem: string }> {
    await this.usuariosService.ativar(id, usuarioLogado);
    await this.auditoriaService.registrar({
      acao: 'usuarios.ativar',
      entidade: 'Usuario',
      entidadeId: id,
      ...autoria(usuarioLogado),
    });
    return { mensagem: 'Usuário ativado com sucesso' };
  }
}
