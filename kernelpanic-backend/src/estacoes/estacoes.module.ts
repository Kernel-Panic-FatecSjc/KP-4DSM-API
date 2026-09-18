import { Module } from '@nestjs/common';
import { EstacoesController } from './estacoes.controller';
import { EstacoesService } from './estacoes.service';

@Module({
  controllers: [EstacoesController],
  providers: [EstacoesService],
})
export class EstacoesModule {}