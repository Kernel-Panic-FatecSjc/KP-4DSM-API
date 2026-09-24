import { Module } from '@nestjs/common';
import { SaudeController } from './saude.controller';
import { SaudeService } from './saude.service';

@Module({
  controllers: [SaudeController],
  providers: [SaudeService],
})
export class SaudeModule {}
