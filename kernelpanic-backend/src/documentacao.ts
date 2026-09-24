import { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';

// Expõe a especificação em /openapi.json e a página navegável em /docs.
// O pipeline de CD baixa o /openapi.json da imagem recém-construída, valida e
// publica no GitHub Pages depois do deploy (US08, docs/CD.md).
export function configurarDocumentacao(app: INestApplication): void {
  const config = new DocumentBuilder()
    .setTitle('KP-4DSM API')
    .setDescription('Monitoramento meteorológico e alertas para Defesa Civil')
    .setVersion(process.env.APP_VERSION ?? 'desenvolvimento')
    .addCookieAuth('access_token')
    .addApiKey(
      { type: 'apiKey', in: 'header', name: 'x-chave-estacao' },
      'chave-estacao',
    )
    .build();

  const documento = SwaggerModule.createDocument(app, config);
  SwaggerModule.setup('docs', app, documento, {
    jsonDocumentUrl: 'openapi.json',
  });
}
