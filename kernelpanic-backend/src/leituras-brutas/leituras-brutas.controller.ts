import { Controller, Get, Query } from '@nestjs/common';
import { ListarLeiturasBrutasQueryDto } from './dto/listar-leituras-brutas-query.dto';
import { ListaLeiturasBrutasRespostaDto } from './dto/lista-leituras-brutas-resposta.dto';
import { LeiturasBrutasService } from './leituras-brutas.service';

@Controller('leituras-brutas')
export class LeiturasBrutasController {
  constructor(private readonly leiturasBrutasService: LeiturasBrutasService) {}

  @Get()
  listar(@Query() query: ListarLeiturasBrutasQueryDto): Promise<ListaLeiturasBrutasRespostaDto> {
    return this.leiturasBrutasService.listar(query);
  }
}