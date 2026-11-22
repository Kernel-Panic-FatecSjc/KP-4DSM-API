import { ApiOkResponse, ApiOperation, ApiServiceUnavailableResponse, ApiTags } from '@nestjs/swagger';
import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SaudeRespostaDto } from './dto/saude-resposta.dto';
import { EstadoSaude, SaudeService } from './saude.service';

// Pública e fora do limite de requisições, para o monitoramento não ser barrado.
@ApiTags('saude')
@Controller('saude')
@SkipThrottle()
export class SaudeController {
  constructor(private readonly saudeService: SaudeService) {}

  @Get()
  @ApiOperation({ summary: 'Verificar a saúde da API', description: 'Health check público, fora do limite de requisições: confere a conexão com o banco.' })
  @ApiOkResponse({ type: SaudeRespostaDto, description: 'API e banco respondendo.' })
  @ApiServiceUnavailableResponse({ type: SaudeRespostaDto, description: 'Banco indisponível; o corpo aponta o componente com falha.' })
  async verificar(): Promise<EstadoSaude> {
    const estado = await this.saudeService.verificar();

    // O corpo do 503 diz qual componente falhou, para o health check pós-deploy.
    if (estado.banco !== 'ok') {
      throw new ServiceUnavailableException(estado);
    }

    return estado;
  }
}
