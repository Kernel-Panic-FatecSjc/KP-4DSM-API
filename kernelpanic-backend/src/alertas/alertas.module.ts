import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { AlertasController } from './alertas.controller';
import { AlertasService } from './alertas.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), UsuariosModule],
  controllers: [AlertasController],
  providers: [AlertasService, GuardaAdministrador],
})
export class AlertasModule {}
