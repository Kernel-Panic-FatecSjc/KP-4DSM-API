import { INestApplication, ValidationPipe } from '@nestjs/common';
import cookieParser from 'cookie-parser';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { HEADER_CHAVE_INGESTAO } from './estacoes/chave-ingestao';

/** Configuração comum à API e às apps dos testes funcionais. */
export function configurarApp(app: INestApplication): void {
  app.use(cookieParser());
  app.useGlobalPipes(new ValidationPipe({ whitelist: true, transform: true }));
  configurarDocumentacao(app);
  // Sem isso o SIGTERM (ex.: deploy) encerra o processo sem rodar os hooks de
  // encerramento: na API fecham o LISTEN do tempo real e a conexão com o broker;
  // nos testes da ingestão, drenam o lote ainda em memória.
  app.enableShutdownHooks();
}

/** Swagger em /docs e o documento OpenAPI em /docs-json. Também usado pelos serviços de ingestão e tratamento. */
export function configurarDocumentacao(app: INestApplication): void {
  const swaggerConfig = new DocumentBuilder()
    .setTitle('Kernel Panic API')
    .setDescription(
      'API do DATA PANIC: dados meteorológicos, estações, alarmes e alertas. ' +
        'Rotas logadas usam o cookie JWT (faça POST /autenticacao/login nesta mesma página); ' +
        'a ingestão usa a chave da estação no header.',
    )
    .setVersion('1.0')
    .addCookieAuth(
      'access_token',
      { type: 'apiKey', in: 'cookie' },
      'access_token',
    )
    .addApiKey(
      { type: 'apiKey', in: 'header', name: HEADER_CHAVE_INGESTAO },
      HEADER_CHAVE_INGESTAO,
    )
    .build();
  SwaggerModule.setup(
    'docs',
    app,
    SwaggerModule.createDocument(app, swaggerConfig),
  );
}
