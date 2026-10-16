import { Module } from '@nestjs/common';
import { IngestaoModule } from '../ingestao/ingestao.module';
import { SaudeController } from './saude.controller';
import { SaudeService } from './saude.service';

@Module({
  imports: [IngestaoModule],
  controllers: [SaudeController],
  providers: [SaudeService],
})
export class SaudeModule {}