import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { PrismaModule } from '../../src/prisma/prisma.module';
import { SaudeTratamentoController } from './saude.controller';
import { TratamentoService } from './tratamento.service';

/** Aplicação do serviço de tratamento (VPS 4): processo próprio, fora do backend. */
@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true }), PrismaModule],
  controllers: [SaudeTratamentoController],
  providers: [TratamentoService],
})
export class TratamentoAppModule {}
