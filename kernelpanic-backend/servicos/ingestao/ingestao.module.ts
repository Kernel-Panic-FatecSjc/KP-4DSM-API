import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { GuardaChaveIngestao } from './http/guarda-chave-ingestao.guard';
import { IngestaoController } from './http/ingestao.controller';
import { IngestaoService } from './ingestao.service';
import { LeiturasBrutasRepositorio } from './leituras-brutas.repositorio';
import { AssinanteMqttService } from './mqtt/assinante-mqtt.service';
import { SaudeIngestaoController } from './saude.controller';

/** Aplicação do serviço de ingestão (VPS 2): processo próprio, fora do backend. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [IngestaoController, SaudeIngestaoController],
  providers: [IngestaoService, LeiturasBrutasRepositorio, AssinanteMqttService, GuardaChaveIngestao],
  exports: [IngestaoService],
})
export class IngestaoAppModule {}
