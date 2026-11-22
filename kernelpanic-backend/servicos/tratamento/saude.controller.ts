import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SaudeTratamentoRespostaDto } from './dto/saude-tratamento-resposta.dto';
import { TratamentoService } from './tratamento.service';

/**
 * Health check do tratamento: o último ciclo e quantas leituras brutas ainda
 * esperam (o atraso da cadeia). 503 se o último ciclo falhou ou o banco não responde.
 */
@ApiTags('saude')
@Controller('saude')
export class SaudeTratamentoController {
  constructor(private readonly tratamento: TratamentoService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar a saúde do serviço de tratamento', description: 'Health check: último ciclo, escuta do banco e leituras brutas pendentes.' })
  @ApiOkResponse({ type: SaudeTratamentoRespostaDto, description: 'Serviço saudável.' })
  @ApiServiceUnavailableResponse({ type: SaudeTratamentoRespostaDto, description: 'O último ciclo falhou ou o banco não responde.' })
  async verificar() {
    const estado = this.tratamento.estado();
    let pendentes: number | null = null;
    try {
      pendentes = await this.tratamento.pendentes();
    } catch {
      throw new ServiceUnavailableException({ ...estado, banco: 'falha' });
    }
    const resposta = { ...estado, banco: 'ok', pendentes };
    if (!estado.ultimoCicloOk) throw new ServiceUnavailableException(resposta);
    return resposta;
  }
}
