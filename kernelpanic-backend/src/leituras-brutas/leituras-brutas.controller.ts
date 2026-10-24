import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { GuardaJwt } from '../autenticacao/guarda-jwt.guard';
import { ListarLeiturasBrutasQueryDto } from './dto/listar-leituras-brutas-query.dto';
import { ListaLeiturasBrutasRespostaDto } from './dto/lista-leituras-brutas-resposta.dto';
import { LeiturasBrutasService } from './leituras-brutas.service';

@Controller('leituras-brutas')
@UseGuards(GuardaJwt)
export class LeiturasBrutasController {
  constructor(private readonly leiturasBrutasService: LeiturasBrutasService) {}

  @Get()
  listar(@Query() query: ListarLeiturasBrutasQueryDto): Promise<ListaLeiturasBrutasRespostaDto> {
    return this.leiturasBrutasService.listar(query);
  }
}
