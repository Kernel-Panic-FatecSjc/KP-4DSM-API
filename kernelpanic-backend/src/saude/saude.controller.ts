import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { SaudeService } from './saude.service';

// Usado pelo healthcheck do pipeline de CD (docs/CD.md): o deploy só é
// considerado bem-sucedido quando esta rota responde 200. Por isso ela checa o
// banco, e não apenas se o processo está de pé.
@Controller('health')
export class SaudeController {
  constructor(private readonly saudeService: SaudeService) {}

  @Get()
  async verificar() {
    const banco = await this.saudeService.bancoDisponivel();
    const resposta = {
      status: banco ? 'ok' : 'erro',
      banco: banco ? 'ok' : 'indisponivel',
      versao: this.saudeService.versao(),
    };

    if (!banco) {
      throw new ServiceUnavailableException(resposta);
    }

    return resposta;
  }
}
