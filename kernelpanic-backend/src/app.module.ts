import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { AlarmesModule } from './alarmes/alarmes.module';
import { AlertasModule } from './alertas/alertas.module';
import { AuditoriaModule } from './auditoria/auditoria.module';
import { AuditoriaAcessoMiddleware } from './auditoria/auditoria-acesso.middleware';
import { AppController } from './app.controller';
import { AppService } from './app.service';
import { AutenticacaoModule } from './autenticacao/autenticacao.module';
import { DashboardModule } from './dashboard/dashboard.module';
import { EstacoesModule } from './estacoes/estacoes.module';
import { IngestaoModule } from './ingestao/ingestao.module';
import { LeiturasBrutasModule } from './leituras-brutas/leituras-brutas.module';
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
    LeiturasBrutasModule,
    SensoresModule,
  ],
  controllers: [AppController],
  providers: [AppService],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(AuditoriaAcessoMiddleware).forRoutes('*');
  }
}
