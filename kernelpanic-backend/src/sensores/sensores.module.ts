import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { SensoresController } from './sensores.controller';
import { SensoresService } from './sensores.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), UsuariosModule],
  controllers: [SensoresController],
  providers: [SensoresService, GuardaAdministrador],
})
export class SensoresModule {}
