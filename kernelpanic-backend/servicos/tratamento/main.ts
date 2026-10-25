import 'dotenv/config';
import { ConfigService } from '@nestjs/config';
import { NestFactory } from '@nestjs/core';
import { TratamentoAppModule } from './tratamento.module';

async function bootstrap() {
  const app = await NestFactory.create(TratamentoAppModule);
  app.enableShutdownHooks();
  // HTTP só para o /saude (monitoramento e health check do deploy).
  await app.listen(app.get(ConfigService).get<string>('TRATAMENTO_PORTA', '3003'));
}
bootstrap();
