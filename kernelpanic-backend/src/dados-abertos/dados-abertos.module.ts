import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { DadosAbertosController } from './dados-abertos.controller';
import { DadosAbertosService } from './dados-abertos.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [DadosAbertosController],
  providers: [DadosAbertosService],
})
export class DadosAbertosModule {}
