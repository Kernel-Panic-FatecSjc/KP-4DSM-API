import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import cookieParser from 'cookie-parser';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);
  const configService = app.get(ConfigService);

  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  // Sem isso o SIGTERM (ex.: deploy) encerra o processo sem rodar o
  // onModuleDestroy, e o lote da ingestão ainda em memória se perde.
  app.enableShutdownHooks();
  app.enableCors({
    origin: configService.get<string>('FRONTEND_URL', 'http://localhost:3000'),
    credentials: true,
  });

  await app.listen(configService.get<string>('PORT', '3001'));
}
bootstrap();
