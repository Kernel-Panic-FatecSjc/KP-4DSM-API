import { Controller, Get, ServiceUnavailableException } from '@nestjs/common';
import { TratamentoService } from './tratamento.service';

/**
 * Health check do tratamento: o último ciclo e quantas leituras brutas ainda
 * esperam (o atraso da cadeia). 503 se o último ciclo falhou ou o banco não responde.
 */
@Controller('saude')
export class SaudeTratamentoController {
  constructor(private readonly tratamento: TratamentoService) {}

  @Get()
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
