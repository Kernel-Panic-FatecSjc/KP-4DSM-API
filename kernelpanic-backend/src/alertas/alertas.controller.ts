import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
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
import { MensagemRespostaDto, NaoEncontrado, Proibido, RequisicaoInvalida, RotaLogada, RotaPublicaComLimite } from '../documentacao/respostas';
import { resolverRegiao } from '../regiao/regiao';
import { AlertasService } from './alertas.service';
import { AlertaRespostaDto } from './dto/alerta-resposta.dto';
import { AtualizarAlertaDto } from './dto/atualizar-alerta.dto';
import { CriarAlertaDto } from './dto/criar-alerta.dto';
import { ListaAlertasRespostaDto } from './dto/lista-alertas-resposta.dto';
import { FiltrosAlertasQueryDto, ListarAlertasQueryDto } from './dto/listar-alertas-query.dto';
import { OpcoesFiltroAlertasRespostaDto } from './dto/opcoes-filtro-alertas-resposta.dto';

const PARAMETRO_ID = { name: 'id', description: 'Identificador (UUID) do alerta.', example: '7c9e6679-7425-40de-944b-e07fc1f90ae7' };

@ApiTags('alertas')
@Controller('alertas')
@UseGuards(GuardaJwt, GuardaPerfil)
export class AlertasController {
  constructor(
    private readonly alertasService: AlertasService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @Publico()
  @RotaPublicaComLimite()
  @ApiOperation({
    summary: 'Listar alertas (regras de limite)',
    description:
      'Rota pública: o visitante sem login precisa informar latitude e longitude e só vê alertas de estações num raio de 100 km. Quem está logado vê os da própria licitação (a Tecsus, de todas) e pode filtrar por região.',
  })
  @ApiOkResponse({ type: ListaAlertasRespostaDto, description: 'Página de alertas.' })
  @RequisicaoInvalida('Filtro inválido, ou visitante sem latitude e longitude.')
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
  @RotaLogada()
  @ApiOperation({ summary: 'Cadastrar alerta', description: 'Define a regra que gera alarmes quando uma medida cruza o limite.' })
  @ApiCreatedResponse({ type: AlertaRespostaDto, description: 'Alerta cadastrado.' })
  @RequisicaoInvalida('Dados inválidos, parâmetro inexistente ou de outra licitação.')
  @Proibido('Perfil sem permissão.')
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
  @RotaLogada()
  @ApiOperation({ summary: 'Atualizar alerta', description: 'Altera os campos informados: condição, limite, severidade, parâmetro monitorado ou ativação.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: AlertaRespostaDto, description: 'Alerta atualizado.' })
  @RequisicaoInvalida('Dados inválidos, parâmetro inexistente ou de outra licitação.')
  @Proibido('Perfil sem permissão.')
  @NaoEncontrado('Alerta inexistente ou fora do escopo do chamador.')
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
  @RotaLogada()
  @ApiOperation({ summary: 'Inativar alerta', description: 'Marca o alerta como inativo (não apaga); o histórico de alarmes é mantido.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: MensagemRespostaDto, description: 'Alerta inativado.' })
  @Proibido('Perfil sem permissão.')
  @NaoEncontrado('Alerta inexistente ou fora do escopo do chamador.')
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
  @RotaPublicaComLimite()
  @ApiOperation({
    summary: 'Opções dos filtros de alertas',
    description: 'Estações, sensores e severidades que o chamador pode usar para filtrar. Visitante sem login precisa informar latitude e longitude.',
  })
  @ApiOkResponse({ type: OpcoesFiltroAlertasRespostaDto, description: 'Opções de filtro.' })
  @RequisicaoInvalida('Filtro inválido, ou visitante sem latitude e longitude.')
  async buscarOpcoesFiltro(
    @Query() query: FiltrosAlertasQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado | null,
  ): Promise<OpcoesFiltroAlertasRespostaDto> {
    return this.alertasService.buscarOpcoesFiltro(resolverRegiao(query, Boolean(usuario)), usuario, query.licitacaoId);
  }
}
