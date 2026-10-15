import { Controller, Get, HttpCode, HttpStatus, ServiceUnavailableException } from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { SaudeService } from './saude.service';

@Controller('saude')
@SkipThrottle()
export class SaudeController {
  constructor(private readonly saudeService: SaudeService) {}

  @Get()
  @HttpCode(HttpStatus.OK)
  async verificar(): Promise<void> {
    const saudavel = await this.saudeService.verificar();

    if (!saudavel) {
      throw new ServiceUnavailableException();
    }
  }
}