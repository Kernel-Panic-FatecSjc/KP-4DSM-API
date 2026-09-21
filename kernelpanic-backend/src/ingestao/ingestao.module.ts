import { Module } from '@nestjs/common';
import { IngestaoController } from './ingestao.controller';
import { IngestaoService } from './ingestao.service';
import { TelemetriaService } from './telemetria.service';

@Module({
  controllers: [IngestaoController],
  providers: [IngestaoService, TelemetriaService],
  exports: [TelemetriaService],
})
export class IngestaoModule {}
