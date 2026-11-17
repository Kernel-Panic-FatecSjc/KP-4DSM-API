import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { RelatoriosController } from './relatorios.controller';
import { IncidentesService } from './incidentes.service';
import { RelatoriosService } from './relatorios.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [RelatoriosController],
  providers: [RelatoriosService, IncidentesService],
})
export class RelatoriosModule {}
