import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { LeiturasBrutasController } from './leituras-brutas.controller';
import { LeiturasBrutasService } from './leituras-brutas.service';
import { LeiturasErroController } from './leituras-erro.controller';
import { LeiturasErroService } from './leituras-erro.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [LeiturasBrutasController, LeiturasErroController],
  providers: [LeiturasBrutasService, LeiturasErroService],
})
export class LeiturasBrutasModule {}
