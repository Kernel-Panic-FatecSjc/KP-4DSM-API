import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

/** Configuração comum à API e às apps dos testes funcionais. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kernel Panic API')
    .setDescription('API do sistema DATA PANIC')
    .setVersion('1.0')
    .addCookieAuth(
      'access_token',
      { type: 'apiKey', in: 'cookie' },
      'access_token',
    )
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );
  // Sem isso o SIGTERM (ex.: deploy) encerra o processo sem rodar os hooks de
  // encerramento: na API fecham o LISTEN do tempo real e a conexão com o broker;
  // nos testes da ingestão, drenam o lote ainda em memória.
  app.enableShutdownHooks();
}
