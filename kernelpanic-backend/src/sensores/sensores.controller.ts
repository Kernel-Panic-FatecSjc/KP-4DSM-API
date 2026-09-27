import { Body, Controller, Delete, Get, HttpCode, HttpStatus, Param, Patch, Post, UseGuards } from '@nestjs/common';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AtualizarSensorDto } from './dto/atualizar-sensor.dto';
import { CriarSensorDto } from './dto/criar-sensor.dto';
import { SensorRespostaDto } from './dto/sensor-resposta.dto';
import { SensoresService } from './sensores.service';
import { CATALOGO_UNIDADES, type DescricaoUnidade } from './unidade-sensor';

@Controller('sensores')
@UseGuards(GuardaJwt)
export class SensoresController {
  constructor(
    private readonly sensoresService: SensoresService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  async listar(): Promise<SensorRespostaDto[]> {
    const sensores = await this.sensoresService.listar();
    return sensores.map((sensor) => new SensorRespostaDto(sensor));
  }

  // Fonte única das unidades aceitas: o front monta o seletor a partir daqui
  // em vez de repetir a lista.
  @Get('unidades')
  listarUnidades(): DescricaoUnidade[] {
    return CATALOGO_UNIDADES;
  }

  @Post()
  async criar(
    @Body() dto: CriarSensorDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<SensorRespostaDto> {
    const sensor = await this.sensoresService.criar(dto);
    await this.auditoriaService.registrar({
      acao: 'sensores.criar',
      entidade: 'TipoParametro',
      entidadeId: sensor.id,
      usuarioId: usuario.sub,
      detalhes: { nome: dto.nome, unidade: dto.unidade },
    });
    return new SensorRespostaDto(sensor);
  }

  @Patch(':id')
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarSensorDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<SensorRespostaDto> {
    const sensor = await this.sensoresService.atualizar(id, dto);
    await this.auditoriaService.registrar({
      acao: 'sensores.atualizar',
      entidade: 'TipoParametro',
      entidadeId: id,
      usuarioId: usuario.sub,
      detalhes: { campos: camposInformados(dto) },
    });
    return new SensorRespostaDto(sensor);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.OK)
  async remover(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<{ mensagem: string }> {
    await this.sensoresService.remover(id);
    await this.auditoriaService.registrar({
      acao: 'sensores.remover',
      entidade: 'TipoParametro',
      entidadeId: id,
      usuarioId: usuario.sub,
    });
    return { mensagem: 'Sensor removido com sucesso' };
  }
}
