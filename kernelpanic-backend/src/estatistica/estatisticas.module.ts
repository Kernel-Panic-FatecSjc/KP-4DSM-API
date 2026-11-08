import { Module } from '@nestjs/common';
import { EstatisticaController } from './estatistica.controller';
import { EstatisticaService } from './estatica.service';

@Module({ controllers: [EstatisticaController], providers: [EstatisticaService] })
export class EstatisticasModule {}
