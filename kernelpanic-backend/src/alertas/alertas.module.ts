import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), UsuariosModule],
  controllers: [AlertasController],
  providers: [AlertasService],
})
export class AlertasModule {}
