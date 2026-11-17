import { ApiCreatedResponse, ApiOkResponse, ApiOperation, ApiParam, ApiTags } from '@nestjs/swagger';
import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import { autoria } from '../auditoria/autoria';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { Conflito, MensagemRespostaDto, NaoEncontrado, Proibido, RequisicaoInvalida, RotaLogada } from '../documentacao/respostas';
import { AtualizarSensorDto } from './dto/atualizar-sensor.dto';
import { CriarSensorDto } from './dto/criar-sensor.dto';
import { ListarSensoresQueryDto } from './dto/listar-sensores-query.dto';
import { ListaSensoresRespostaDto, SensorRespostaDto, UnidadeSensorRespostaDto } from './dto/sensor-resposta.dto';
import { SensoresService } from './sensores.service';
import { CATALOGO_UNIDADES, type DescricaoUnidade } from './unidade-sensor';

const PARAMETRO_ID = { name: 'id', description: 'Identificador (UUID) do sensor.', example: '11111111-1111-4111-8111-111111111111' };

@ApiTags('sensores')
@Controller('sensores')
@UseGuards(GuardaJwt, GuardaPerfil)
@RotaLogada()
export class SensoresController {
  constructor(
    private readonly sensoresService: SensoresService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar sensores', description: 'Paginada. Usuário de licitação vê só os da própria licitação.' })
  @ApiOkResponse({ type: ListaSensoresRespostaDto, description: 'Página de sensores.' })
  @RequisicaoInvalida('Filtro ou paginação inválidos.')
  async listar(
    @Query() query: ListarSensoresQueryDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<ListaSensoresRespostaDto> {
    const { itens, total, pagina, tamanho } = await this.sensoresService.listar(query, usuario);
    return new ListaSensoresRespostaDto(itens.map((sensor) => new SensorRespostaDto(sensor)), total, pagina, tamanho);
  }

  // Fonte única das unidades aceitas: o front monta o seletor a partir daqui
  // em vez de repetir a lista.
  @Get('unidades')
  @ApiOperation({ summary: 'Listar unidades de medida aceitas', description: 'Catálogo fechado de unidades aceitas no cadastro de sensores.' })
  @ApiOkResponse({ type: UnidadeSensorRespostaDto, isArray: true, description: 'Unidades, na ordem de apresentação.' })
  listarUnidades(): DescricaoUnidade[] {
    return CATALOGO_UNIDADES;
  }

  @Post()
  @Perfis(...PERFIS_ADMIN)
  @ApiOperation({ summary: 'Cadastrar sensor', description: 'Licitação encerrada não recebe sensores.' })
  @ApiCreatedResponse({ type: SensorRespostaDto, description: 'Sensor cadastrado.' })
  @RequisicaoInvalida('Dados inválidos, faixa física invertida, ou licitação ausente, inexistente ou encerrada.')
  @Proibido('Perfil sem permissão.')
  @Conflito('Já existe um sensor com este nome nesta licitação.')
  async criar(
    @Body() dto: CriarSensorDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<SensorRespostaDto> {
    const sensor = await this.sensoresService.criar(dto, usuario);
    await this.auditoriaService.registrar({
      acao: 'sensores.criar',
      entidade: 'TipoParametro',
      entidadeId: sensor.id,
      ...autoria(usuario),
      detalhes: { nome: dto.nome, unidade: dto.unidade, agregacao: sensor.agregacao, licitacaoId: sensor.licitacaoId },
    });
    return new SensorRespostaDto(sensor);
  }

  @Patch(':id')
  @Perfis(...PERFIS_ADMIN)
  @ApiOperation({ summary: 'Atualizar sensor', description: 'Altera os campos informados. A faixa física (valorMinimo e valorMaximo) é validada em conjunto.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: SensorRespostaDto, description: 'Sensor atualizado.' })
  @RequisicaoInvalida('Dados inválidos ou faixa física invertida (valorMinimo maior que valorMaximo).')
  @Proibido('Perfil sem permissão.')
  @NaoEncontrado('Sensor inexistente ou fora do escopo do chamador.')
  @Conflito('Já existe um sensor com este nome nesta licitação.')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarSensorDto,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<SensorRespostaDto> {
    const sensor = await this.sensoresService.atualizar(id, dto, usuario);
    await this.auditoriaService.registrar({
      acao: 'sensores.atualizar',
      entidade: 'TipoParametro',
      entidadeId: id,
      ...autoria(usuario),
      detalhes: { campos: camposInformados(dto) },
    });
    return new SensorRespostaDto(sensor);
  }

  @Delete(':id')
  @Perfis(...PERFIS_ADMIN)
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Remover sensor', description: 'Só remove sensor que não está associado a estações.' })
  @ApiParam(PARAMETRO_ID)
  @ApiOkResponse({ type: MensagemRespostaDto, description: 'Sensor removido.' })
  @Proibido('Perfil sem permissão.')
  @NaoEncontrado('Sensor inexistente ou fora do escopo do chamador.')
  @Conflito('O sensor está associado a estações; remova a associação antes.')
  async remover(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: UsuarioLogado,
  ): Promise<{ mensagem: string }> {
    await this.sensoresService.remover(id, usuario);
    await this.auditoriaService.registrar({
      acao: 'sensores.remover',
      entidade: 'TipoParametro',
      entidadeId: id,
      ...autoria(usuario),
    });
    return { mensagem: 'Sensor removido com sucesso' };
  }
}
