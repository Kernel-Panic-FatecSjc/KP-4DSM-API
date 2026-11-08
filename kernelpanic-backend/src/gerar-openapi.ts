// Gera o contrato OpenAPI da API (RNF12) em um arquivo JSON, sem subir o servidor:
// o modo preview do Nest monta só o mapa de rotas, sem conectar no banco nem no
// broker. Roda a partir do build (o CI valida e publica o arquivo).
// Uso: npm run build && npm run openapi:gerar [-- caminho/do/arquivo.json]   (padrão: openapi.json)
import { NestFactory } from '@nestjs/core';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { AppModule } from './app.module';
import { criarDocumentoOpenApi } from './configurar-app';

async function gerar(): Promise<void> {
  const destino = resolve(process.argv[2] ?? 'openapi.json');
  const app = await NestFactory.create(AppModule, { preview: true, abortOnError: false, logger: ['error'] });
  const documento = criarDocumentoOpenApi(app);
  await app.close();

  mkdirSync(dirname(destino), { recursive: true });
  writeFileSync(destino, `${JSON.stringify(documento, null, 2)}\n`);
  console.log(`OpenAPI ${documento.openapi} gerado em ${destino} (${Object.keys(documento.paths).length} caminhos)`);
}

gerar().catch((erro) => {
  console.error('Falha ao gerar o OpenAPI:', erro);
  process.exit(1);
});
