import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { ContratosController } from './contratos.controller';
import { ContratosService } from './contratos.service';

@Module({
  imports: [PassportModule.register({ defaultStrategy: 'jwt' }), AuditoriaModule, UsuariosModule],
  controllers: [ContratosController],
  providers: [ContratosService, GuardaAdministrador],
})
export class ContratosModule {}
