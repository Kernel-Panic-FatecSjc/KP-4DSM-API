import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlarmesModule } from './alarmes/alarmes.module';
import { AlertasModule } from './alertas/alertas.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AutenticacaoModule } from './autenticacao/autenticacao.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EstacoesModule } from './estacoes/estacoes.module';
import { IngestaoModule } from './ingestao/ingestao.module';
import { PrismaModule } from './prisma/prisma.module';
import { SensoresModule } from './sensores/sensores.module';
import { UsuariosModule } from './usuarios/usuarios.module';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    PrismaModule,
    UsuariosModule,
    AutenticacaoModule,
    AlarmesModule,
    AlertasModule,
    AuditoriaModule,
    DashboardModule,
    EstacoesModule,
    IngestaoModule,
    SensoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule {}
