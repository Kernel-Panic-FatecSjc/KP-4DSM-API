import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, Query, UseGuards } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import { autoria } from '../auditoria/autoria';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { Perfis, PERFIS_ADMIN } from '../autenticacao/perfis.decorator';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AtualizarSensorDto } from './dto/atualizar-sensor.dto';
import { CriarSensorDto } from './dto/criar-sensor.dto';
import { ListarSensoresQueryDto } from './dto/listar-sensores-query.dto';
import { ListaSensoresRespostaDto, SensorRespostaDto } from './dto/sensor-resposta.dto';
import { SensoresService } from './sensores.service';
import { CATALOGO_UNIDADES, type DescricaoUnidade } from './unidade-sensor';

@Controller('sensores')
@UseGuards(GuardaJwt, GuardaPerfil)
export class SensoresController {
  constructor(
    private readonly sensoresService: SensoresService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
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
  listarUnidades(): DescricaoUnidade[] {
    return CATALOGO_UNIDADES;
  }

  @Post()
  @Perfis(...PERFIS_ADMIN)
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
      detalhes: { nome: dto.nome, unidade: dto.unidade, licitacaoId: sensor.licitacaoId },
    });
    return new SensorRespostaDto(sensor);
  }

  @Patch(':id')
  @Perfis(...PERFIS_ADMIN)
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
