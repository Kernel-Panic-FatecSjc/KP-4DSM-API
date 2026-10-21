import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiCookieAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { camposInformados } from '../auditoria/campos-informados';
import { AtualizarOrgaoDto } from './dto/atualizar-orgao.dto';
import { CriarOrgaoDto } from './dto/criar-orgao.dto';
import { ListarOrgaosQueryDto } from './dto/listar-orgaos-query.dto';
import { OrgaoRespostaDto } from './dto/orgao-resposta.dto';
import { OrgaosService } from './orgaos.service';

@ApiTags('Órgãos contratantes')
@ApiCookieAuth('access_token')
@Controller('orgaos')
@UseGuards(GuardaJwt)
export class OrgaosController {
  constructor(
    private readonly orgaosService: OrgaosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Lista órgãos contratantes' })
  @ApiResponse({ status: 200, type: OrgaoRespostaDto, isArray: true })
  async listar(@Query() query: ListarOrgaosQueryDto) {
    const orgaos = await this.orgaosService.listar(query);
    return orgaos.map((orgao) => new OrgaoRespostaDto(orgao));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta um órgão contratante' })
  @ApiResponse({ status: 200, type: OrgaoRespostaDto })
  async consultar(@Param('id') id: string) {
    const orgao = await this.orgaosService.consultar(id);
    return new OrgaoRespostaDto(orgao);
  }

  @Post()
  @UseGuards(GuardaAdministrador)
  @ApiOperation({ summary: 'Cadastra um órgão contratante' })
  @ApiResponse({ status: 201, type: OrgaoRespostaDto })
  async criar(
    @Body() dto: CriarOrgaoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ) {
    const orgao = await this.orgaosService.criar(dto);
    await this.auditoriaService.registrar({
      acao: 'orgaos.criar',
      entidade: 'OrgaoPublico',
      entidadeId: orgao.id,
      usuarioId: usuario.sub,
      detalhes: { nome: dto.nome, cnpj: dto.cnpj },
    });
    return new OrgaoRespostaDto(orgao);
  }

  @Patch(':id')
  @UseGuards(GuardaAdministrador)
  @ApiOperation({ summary: 'Edita um órgão contratante' })
  @ApiResponse({ status: 200, type: OrgaoRespostaDto })
  async atualizar(
    @Param('id') id: string,
    @Body() dto: AtualizarOrgaoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ) {
    const orgao = await this.orgaosService.atualizar(id, dto);
    await this.auditoriaService.registrar({
      acao: 'orgaos.atualizar',
      entidade: 'OrgaoPublico',
      entidadeId: id,
      usuarioId: usuario.sub,
      detalhes: { campos: camposInformados(dto) },
    });
    return new OrgaoRespostaDto(orgao);
  }

  @Delete(':id')
  @UseGuards(GuardaAdministrador)
  @ApiOperation({ summary: 'Inativa um órgão contratante' })
  @ApiResponse({ status: 200, type: OrgaoRespostaDto })
  async inativar(
    @Param('id') id: string,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ) {
    const orgao = await this.orgaosService.inativar(id);
    await this.auditoriaService.registrar({
      acao: 'orgaos.inativar',
      entidade: 'OrgaoPublico',
      entidadeId: id,
      usuarioId: usuario.sub,
    });
    return new OrgaoRespostaDto(orgao);
  }
}
