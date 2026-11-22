import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { GuardaPerfil } from '../autenticacao/guarda-perfil.guard';
import type { UsuarioLogado } from '../autenticacao/payload-jwt.interface';
import { UsuarioAutenticado } from '../autenticacao/usuario-autenticado.decorator';
import { RequisicaoInvalida, RotaLogada } from '../documentacao/respostas';
import { ListaLeiturasErroRespostaDto } from './dto/leitura-erro-resposta.dto';
import { ListarLeiturasErroQueryDto } from './dto/listar-leituras-erro-query.dto';
import { LeiturasErroService } from './leituras-erro.service';

@ApiTags('leituras-erro')
@Controller('leituras-erro')
@UseGuards(GuardaJwt, GuardaPerfil)
@RotaLogada()
export class LeiturasErroController {
  constructor(private readonly leiturasErroService: LeiturasErroService) {}

  @Get()
  @ApiOperation({
    summary: 'Listar leituras que não viraram medida',
    description:
      'Leituras que o tratamento recebeu e recusou: estação não cadastrada, sensor não configurado ou valor fora da faixa física. Usuário de licitação vê só as da própria licitação.',
  })
  @ApiOkResponse({ type: ListaLeiturasErroRespostaDto, description: 'Página de leituras com erro.' })
  @RequisicaoInvalida('Filtro ou paginação inválidos.')
  listar(@Query() query: ListarLeiturasErroQueryDto, @UsuarioAutenticado() usuario: UsuarioLogado) {
    return this.leiturasErroService.listar(query, usuario);
  }
}
