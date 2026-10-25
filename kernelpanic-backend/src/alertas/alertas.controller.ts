import { Body, Controller, Delete, Get, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { Publico } from '../autenticacao/publico.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { autoria } from '../auditoria/autoria';
import { camposInformados } from '../auditoria/campos-informados';
import { resolverRegiao } from '../regiao/regiao';
import { AlertasService } from './alertas.service';
import { AlertaRespostaDto } from './dto/alerta-resposta.dto';
import { AtualizarAlertaDto } from './dto/atualizar-alerta.dto';
import { CriarAlertaDto } from './dto/criar-alerta.dto';
import { ListaAlertasRespostaDto } from './dto/lista-alertas-resposta.dto';
import { FiltrosAlertasQueryDto, ListarAlertasQueryDto } from './dto/listar-alertas-query.dto';
import { OpcoesFiltroAlertasRespostaDto } from './dto/opcoes-filtro-alertas-resposta.dto';

@Controller('alertas')
@UseGuards(GuardaJwt, GuardaPerfil)
export class AlertasController {
  constructor(
    private readonly alertasService: AlertasService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Publico()
  async listar(
    @Query() query: ListarAlertasQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado | null,
  ): Promise<ListaAlertasRespostaDto> {
    const regiao = resolverRegiao(query, Boolean(usuario));
    const resultado = await this.alertasService.listar(query, regiao, usuario);
    // A localização do visitante é dado pessoal: fica fora da auditoria.
    const { latitude: _latitude, longitude: _longitude, ...filtros } = query;
    await this.auditoriaService.registrar({
      acao: 'alertas.consultar',
      entidade: 'Alerta',
      ...autoria(usuario),
      detalhes: { ...filtros, porRegiao: Boolean(regiao) },
    });
    return resultado;
  }

  @Post()
  @Perfis(...PERFIS_ADMIN)
  async criar(
    @Body() dto: CriarAlertaDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<AlertaRespostaDto> {
    const alerta = await this.alertasService.criar(dto, usuario);
    await this.auditoriaService.registrar({
      acao: 'alertas.criar',
      entidade: 'Alerta',
      entidadeId: alerta.id,
      ...autoria(usuario),
      detalhes: {
        operador: dto.operador,
        valorLimite: dto.valorLimite,
        severidade: dto.severidade,
        parametroId: dto.parametroId,
      },
    });
    return new AlertaRespostaDto(alerta);
  }

  @Patch(':id')
  @Perfis(...PERFIS_ADMIN)
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarAlertaDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<AlertaRespostaDto> {
    const alerta = await this.alertasService.atualizar(id, dto, usuario);
    await this.auditoriaService.registrar({
      acao: 'alertas.atualizar',
      entidade: 'Alerta',
      entidadeId: id,
      ...autoria(usuario),
      detalhes: { campos: camposInformados(dto) },
    });
    return new AlertaRespostaDto(alerta);
  }

  @Delete(':id')
  @Perfis(...PERFIS_ADMIN)
  async inativar(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<{ mensagem: string }> {
    await this.alertasService.inativar(id, usuario);
    await this.auditoriaService.registrar({
      acao: 'alertas.inativar',
      entidade: 'Alerta',
      entidadeId: id,
      ...autoria(usuario),
    });
    return { mensagem: 'Alerta inativado com sucesso' };
  }

  @Get('filtros')
  @Publico()
  async buscarOpcoesFiltro(
    @Query() query: FiltrosAlertasQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado | null,
  ): Promise<OpcoesFiltroAlertasRespostaDto> {
    return this.alertasService.buscarOpcoesFiltro(resolverRegiao(query, Boolean(usuario)), usuario, query.licitacaoId);
  }
}
