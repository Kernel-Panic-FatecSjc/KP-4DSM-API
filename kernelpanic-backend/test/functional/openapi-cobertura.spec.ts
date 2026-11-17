import { INestApplication, type Type } from '@nestjs/common';
import request from 'supertest';
import { IngestaoAppModule } from '../../servicos/ingestao/ingestao.module';
import { TratamentoAppModule } from '../../servicos/tratamento/tratamento.module';
import { AppModule } from '../../src/app.module';
import { criarAppDeTeste } from '../helpers';

type Json = Record<string, any>;

const METODOS = ['get', 'post', 'put', 'patch', 'delete'];

function resolver(doc: Json, esquema?: Json): Json | undefined {
  if (!esquema?.$ref) return esquema;
  return resolver(doc, doc.components.schemas[String(esquema.$ref).split('/').pop()!]);
}

/** Esquema de objeto vazio (DTO sem @ApiProperty) é o sinal de schema não documentado. */
function esquemaVazio(doc: Json, esquema?: Json): boolean {
  const alvo = esquema?.type === 'array' ? resolver(doc, esquema.items) : resolver(doc, esquema);
  if (!alvo) return true;
  if (alvo.type === 'object' && !alvo.properties && !alvo.additionalProperties) return true;
  return alvo.type === 'object' && alvo.properties && Object.keys(alvo.properties).length === 0;
}

function auditar(doc: Json, opcoes: { exigir429: boolean }): string[] {
  const problemas: string[] = [];

  for (const [caminho, operacoes] of Object.entries<Json>(doc.paths)) {
    for (const metodo of METODOS.filter((m) => operacoes[m])) {
      const op = operacoes[metodo];
      const rotulo = `${metodo.toUpperCase()} ${caminho}`;
      const respostas: Json = op.responses ?? {};

      if (!op.summary) problemas.push(`${rotulo}: sem summary (@ApiOperation)`);

      const sucesso = Object.keys(respostas).find((codigo) => codigo.startsWith('2'));
      if (!sucesso) {
        problemas.push(`${rotulo}: sem resposta de sucesso`);
      } else if (sucesso !== '204') {
        const conteudo = Object.values<Json>(respostas[sucesso].content ?? {})[0];
        if (!conteudo || esquemaVazio(doc, conteudo.schema)) problemas.push(`${rotulo}: resposta ${sucesso} sem schema`);
      }

      if (op.requestBody) {
        const conteudo = Object.values<Json>(op.requestBody.content ?? {})[0];
        if (!conteudo || esquemaVazio(doc, conteudo.schema)) problemas.push(`${rotulo}: corpo da requisição sem schema`);
      }

      const temEntrada = Boolean(op.requestBody) || (op.parameters ?? []).some((p: Json) => p.in === 'query');
      if (temEntrada && !respostas['400']) problemas.push(`${rotulo}: falta o 400`);
      if (op.security?.length && !respostas['401']) problemas.push(`${rotulo}: falta o 401`);
      if (opcoes.exigir429 && !caminho.startsWith('/saude') && !respostas['429']) problemas.push(`${rotulo}: falta o 429`);
      for (const [codigo, resposta] of Object.entries<Json>(respostas)) {
        if (!resposta.description) problemas.push(`${rotulo}: resposta ${codigo} sem descrição`);
      }
    }
  }

  for (const [nome, esquema] of Object.entries<Json>(doc.components?.schemas ?? {})) {
    for (const [campo, propriedade] of Object.entries<Json>(esquema.properties ?? {})) {
      const primitivo = ['string', 'number', 'integer', 'boolean'].includes(propriedade.type);
      // Campo autoexplicativo (id, nome) pode ter só o exemplo; todo o resto precisa de descrição.
      if (!propriedade.description && propriedade.example === undefined && !propriedade.$ref && !propriedade.allOf && !propriedade.enum) {
        problemas.push(`${nome}.${campo}: sem description`);
      }
      if (primitivo && propriedade.example === undefined && !propriedade.enum && propriedade.default === undefined) {
        problemas.push(`${nome}.${campo}: sem example`);
      }
    }
  }

  return problemas;
}

describe('Cobertura da documentação OpenAPI (funcional)', () => {
  const apps: INestApplication[] = [];

  // O tratamento grava no banco ao subir (fila de controle): usa o banco de teste de verdade.
  async function documento(modulo: Type, comBancoReal = false): Promise<Json> {
    const app = await criarAppDeTeste({
      modulo,
      prismaMock: comBancoReal
        ? undefined
        : {
            estacao: { findUnique: jest.fn() },
            $executeRawUnsafe: jest.fn(),
            $queryRaw: jest.fn(),
            $connect: jest.fn(),
            $disconnect: jest.fn(),
          },
    });
    apps.push(app);
    return (await request(app.getHttpServer()).get('/docs-json').expect(200)).body;
  }

  afterAll(async () => {
    await Promise.all(apps.map((app) => app.close()));
  });

  it('toda rota da API tem descrição, schemas, exemplos e respostas de erro', async () => {
    expect(auditar(await documento(AppModule), { exigir429: true })).toEqual([]);
  });

  it('toda rota do serviço de ingestão tem descrição, schemas, exemplos e respostas de erro', async () => {
    expect(auditar(await documento(IngestaoAppModule), { exigir429: false })).toEqual([]);
  });

  it('toda rota do serviço de tratamento tem descrição, schemas e respostas', async () => {
    expect(auditar(await documento(TratamentoAppModule, true), { exigir429: false })).toEqual([]);
  });
});
