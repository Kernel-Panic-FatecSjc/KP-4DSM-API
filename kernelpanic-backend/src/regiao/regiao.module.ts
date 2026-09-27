import { Global, Module } from '@nestjs/common';
import { EstacoesProximasService } from './estacoes-proximas.service';

@Global()
@Module({
  providers: [EstacoesProximasService],
  exports: [EstacoesProximasService],
})
export class RegiaoModule {}
