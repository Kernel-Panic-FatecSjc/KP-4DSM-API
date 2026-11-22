import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { EstacoesModule } from '../estacoes/estacoes.module';
import { LicitacoesController } from './licitacoes.controller';
import { LicitacoesService } from './licitacoes.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), EstacoesModule],
  controllers: [LicitacoesController],
  providers: [LicitacoesService],
})
export class LicitacoesModule {}
