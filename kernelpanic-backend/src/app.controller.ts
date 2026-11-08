import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { Controller, Get } from '@nestjs/common';
import { RotaPublicaComLimite } from './documentacao/respostas';
import { AppService } from './app.service';

@ApiTags('aplicacao')
@Controller()
export class AppController {
  constructor(private readonly appService: AppService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar que a API responde', description: 'Rota pública que devolve um texto fixo.' })
  @ApiOkResponse({ type: String, description: 'Texto de boas-vindas da API.' })
  @RotaPublicaComLimite()
  getHello(): string {
    return this.appService.getHello();
  }
}
