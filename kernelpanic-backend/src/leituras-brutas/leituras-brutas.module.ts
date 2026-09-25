import { Module } from '@nestjs/common';
import { PrismaModule } from '../prisma/prisma.module';
import { LeiturasBrutasController } from './leituras-brutas.controller';
import { LeiturasBrutasService } from './leituras-brutas.service';

@Module({
  imports: [PrismaModule],
  controllers: [LeiturasBrutasController],
  providers: [LeiturasBrutasService],
})
export class LeiturasBrutasModule {}