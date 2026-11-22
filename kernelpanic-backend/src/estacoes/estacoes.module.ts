import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EstacoesController } from './estacoes.controller';
import { EstacoesService } from './estacoes.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [EstacoesController],
  providers: [EstacoesService],
  exports: [EstacoesService],
})
export class EstacoesModule {}
