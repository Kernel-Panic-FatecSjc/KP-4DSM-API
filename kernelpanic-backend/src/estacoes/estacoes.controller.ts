import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { CriarEstacaoDto } from './dto/criar-estacao.dto';
import { EstacaoRespostaDto } from './dto/estacao-resposta.dto';
import { ListarEstacoesQueryDto } from './dto/listar-estacoes-query.dto';
import { EstacoesService } from './estacoes.service';

@Controller('estacoes')
@UseGuards(GuardaJwt)
export class EstacoesController {
  constructor(private readonly estacoesService: EstacoesService) {}

  @Get()
  async listar(@Query() query: ListarEstacoesQueryDto): Promise<EstacaoRespostaDto[]> {
    const estacoes = await this.estacoesService.listar(query);
    return estacoes.map((estacao) => new EstacaoRespostaDto(estacao));
  }

  @Post()
  async criar(
    @Body() dto: CriarEstacaoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<EstacaoRespostaDto> {
    const estacao = await this.estacoesService.criar(dto, usuario.sub);
    return new EstacaoRespostaDto(estacao);
  }
}