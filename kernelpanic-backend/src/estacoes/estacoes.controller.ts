import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AtualizarEstacaoDto } from './dto/atualizar-estacao.dto';
import { CriarEstacaoDto } from './dto/criar-estacao.dto';
import { EstacaoRespostaDto } from './dto/estacao-resposta.dto';
import { ListarEstacoesQueryDto } from './dto/listar-estacoes-query.dto';
import { EstacoesService } from './estacoes.service';

@Controller('estacoes')
@UseGuards(GuardaJwt)
export class EstacoesController {
  constructor(
    private readonly estacoesService: EstacoesService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  async listar(
    @Query() query: ListarEstacoesQueryDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<EstacaoRespostaDto[]> {
    const estacoes = await this.estacoesService.listar(query);
    await this.auditoriaService.registrar({
      acao: 'estacoes.consultar',
      entidade: 'Estacao',
      usuarioId: usuario.sub,
      detalhes: { ...query },
    });
    return estacoes.map((estacao) => new EstacaoRespostaDto(estacao));
  }

  @Post()
  async criar(
    @Body() dto: CriarEstacaoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<EstacaoRespostaDto> {
    const estacao = await this.estacoesService.criar(dto, usuario.sub);
    await this.auditoriaService.registrar({
      acao: 'estacoes.criar',
      entidade: 'Estacao',
      entidadeId: estacao.id,
      usuarioId: usuario.sub,
      detalhes: { nome: dto.nome, vid: dto.vid, tipoParametroIds: dto.tipoParametroIds },
    });
    return new EstacaoRespostaDto(estacao);
  }

  @Patch(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarEstacaoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<EstacaoRespostaDto> {
    const estacao = await this.estacoesService.atualizar(id, dto);
    await this.auditoriaService.registrar({
      acao: 'estacoes.atualizar',
      entidade: 'Estacao',
      entidadeId: id,
      usuarioId: usuario.sub,
      detalhes: { campos: camposInformados(dto) },
    });
    return new EstacaoRespostaDto(estacao);
  }

  @Delete(':id')
  async inativar(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<{ mensagem: string }> {
    await this.estacoesService.inativar(id);
    await this.auditoriaService.registrar({
      acao: 'estacoes.inativar',
      entidade: 'Estacao',
      entidadeId: id,
      usuarioId: usuario.sub,
    });
    return { mensagem: 'Estação inativada com sucesso' };
  }
}
