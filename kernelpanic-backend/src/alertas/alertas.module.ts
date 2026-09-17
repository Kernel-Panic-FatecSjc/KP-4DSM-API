import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' })],
  controllers: [AlertasController],
  providers: [AlertasService],
})
export class AlertasModule {}
