import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { EstadoSaude, SaudeService } from './saude.service';

// Pública e fora do limite de requisições, para o monitoramento não ser barrado.
@Controller('saude')
@SkipThrottle()
export class SaudeController {
  constructor(private readonly saudeService: SaudeService) {}

  @Get()
  async verificar(): Promise<EstadoSaude> {
    const estado = await this.saudeService.verificar();

    // O corpo do 503 diz qual componente falhou, para o health check pós-deploy.
    if (estado.banco !== 'ok') {
      throw new ServiceUnavailableException(estado);
    }

    return estado;
  }
}
