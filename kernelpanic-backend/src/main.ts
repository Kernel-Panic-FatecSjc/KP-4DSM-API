import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  configurarApp(app);
  if (process.env.NODE_ENV !== 'production') {
    const documentacao = new DocumentBuilder()
      .setTitle('Kernel Panic API')
      .setDescription('API de monitoramento e gestão de contratos.')
      .setVersion('1.0')
      .addCookieAuth('access_token', { type: 'apiKey', in: 'cookie' })
      .build();
    SwaggerModule.setup(
      'api/docs',
      app,
      SwaggerModule.createDocument(app, documentacao),
    );
  }

  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  await app.listen(configService.get<string>('PORT', '3001'));
}
bootstrap();
