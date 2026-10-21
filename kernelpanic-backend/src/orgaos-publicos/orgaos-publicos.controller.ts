import { Body, Controller, Get, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiConflictResponse,
  ApiCookieAuth,
  ApiCreatedResponse,
  ApiForbiddenResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import type { PayloadJwt } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { AuditoriaService } from '../auditoria/auditoria.service';
import { CriarOrgaoPublicoDto } from './dto/criar-orgao-publico.dto';
import { OrgaoPublicoRespostaDto } from './dto/orgao-publico-resposta.dto';
import { OrgaosPublicosService } from './orgaos-publicos.service';

@Controller('orgaos')
@UseGuards(GuardaJwt)
@ApiTags('órgãos públicos')
@ApiCookieAuth()
@ApiUnauthorizedResponse({
  description: 'Cookie de sessão ausente ou inválido',
})
export class OrgaosPublicosController {
  constructor(
    private readonly orgaosService: OrgaosPublicosService,
    private readonly auditoriaService: AuditoriaService,
  ) {}

  @Get()
  @ApiOperation({ summary: 'Listar órgãos públicos' })
  @ApiOkResponse({ type: OrgaoPublicoRespostaDto, isArray: true })
  async listar(
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<OrgaoPublicoRespostaDto[]> {
    const orgaos = await this.orgaosService.listar();
    await this.auditoriaService.registrar({
      acao: 'orgaos.consultar',
      entidade: 'OrgaoPublico',
      usuarioId: usuario.sub,
    });
    return orgaos.map((orgao) => new OrgaoPublicoRespostaDto(orgao));
  }

  @Post()
  @UseGuards(GuardaAdministrador)
  @ApiOperation({
    summary: 'Cadastrar órgão público',
    description: 'Restrito ao administrador e auditado.',
  })
  @ApiCreatedResponse({ type: OrgaoPublicoRespostaDto })
  @ApiBadRequestResponse({ description: 'Dados inválidos' })
  @ApiConflictResponse({ description: 'CNPJ já cadastrado' })
  @ApiForbiddenResponse({ description: 'Acesso restrito ao administrador' })
  async criar(
    @Body() dto: CriarOrgaoPublicoDto,
    @UsuarioAutenticado() usuario: PayloadJwt,
  ): Promise<OrgaoPublicoRespostaDto> {
    const orgao = await this.orgaosService.criar(dto);
    await this.auditoriaService.registrar({
      acao: 'orgaos.criar',
      entidade: 'OrgaoPublico',
      entidadeId: orgao.id,
      usuarioId: usuario.sub,
      detalhes: { esfera: orgao.esfera, uf: orgao.uf },
    });
    return new OrgaoPublicoRespostaDto(orgao);
  }
}
