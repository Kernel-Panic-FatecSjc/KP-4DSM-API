import { Module } from '@nestjs/common';
import { EstatisticaController } from './estatistica.controller';
import { EstatisticaService } from './estatistica.service';

@Module({ controllers: [EstatisticaController], providers: [EstatisticaService] })
export class EstatisticasModule {}
