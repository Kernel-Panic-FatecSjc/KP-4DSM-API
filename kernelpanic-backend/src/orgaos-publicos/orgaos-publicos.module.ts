import { Module } from '@nestjs/common';
import { PassportModule } from '@nestjs/passport';
import { GuardaAdministrador } from '../autenticacao/guarda-administrador.guard';
import { AuditoriaModule } from '../auditoria/auditoria.module';
import { UsuariosModule } from '../usuarios/usuarios.module';
import { OrgaosPublicosController } from './orgaos-publicos.controller';
import { OrgaosPublicosService } from './orgaos-publicos.service';

@Module({
  imports: [
    PassportModule.register({ defaultStrategy: 'jwt' }),
    AuditoriaModule,
    UsuariosModule,
  ],
  controllers: [OrgaosPublicosController],
  providers: [OrgaosPublicosService, GuardaAdministrador],
})
export class OrgaosPublicosModule {}
