import 'dotenv/config';
import { ValidationPipe } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { configurarDocumentacao } from '../../src/configurar-app';
import { IngestaoAppModule } from './ingestao.module';

async function bootstrap() {
  const app = await NestFactory.create(IngestaoAppModule);
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  configurarDocumentacao(app);
  // Sem isso o SIGTERM encerra o processo sem drenar o lote em memória.
  app.enableShutdownHooks();
  await app.listen(app.get(ConfigService).get<string>('INGESTAO_PORTA', '3002'));
}
bootstrap();
