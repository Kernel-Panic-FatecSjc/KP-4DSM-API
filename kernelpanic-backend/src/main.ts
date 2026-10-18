import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';
import { configurarApp } from './configurar-app';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  configurarApp(app);
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  await app.listen(configService.get<string>('PORT', '3001'));
}
bootstrap();
