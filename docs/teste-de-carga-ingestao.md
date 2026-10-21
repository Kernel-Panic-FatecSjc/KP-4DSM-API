# Teste de carga da ingestão

Medição do `POST /ingestao/telemetria` sob carga HTTP e do armazenamento de séries temporais (SCRUM-43). A meta do plano de QA é **p95 de resposta abaixo de 2 s, sem perda de pacotes**.

> **TODO (SCRUM-43):** repetir a medição quando as tarefas que mudam o caminho da ingestão entrarem na `main`: SCRUM-38 (retry do lote em memória), SCRUM-40 (faixa física e `leituras_erro`) e SCRUM-41 (estação inativa). Os números abaixo são da `main` de antes delas.

## Resumo

| | Antes | Depois |
| --- | --- | --- |
| Maior taxa sustentada (p95 ≤ 2 s, sem erro nem perda) | 400 req/s | **1.000 req/s** |
| Taxa em que a API satura | ~710 req/s | ~1.060 req/s |
| p95 a 800 req/s | 4,97 s (saturada) | **0,31 s** |
| Consulta do dashboard sem filtro de estação (10 milhões de medidas) | 1.302 ms | **16,8 ms** |

Em frota: 1.000 req/s equivalem a 60 mil estações enviando a cada 1 minuto, ou 300 mil a cada 5 minutos. A meta de p95 < 2 s foi atingida com folga, sem nenhum pacote perdido.

Três mudanças explicam o ganho, medidas em separado (ver [O que mudou](#o-que-mudou)):

1. **Defeito corrigido:** cada telemetria recebida gerava uma linha de auditoria, porque o desvio do middleware para `/ingestao` nunca disparava.
2. **Uma consulta só** para carregar a estação, com seus parâmetros e tipos (`relationLoadStrategy: 'join'`).
3. **Índice btree** em `medidas(unixtime)`, para a consulta do dashboard geral.

## Ambiente e método

- **Máquina:** AMD Ryzen 5 7600 (12 threads), 31 GB de RAM, Windows 11. API (Node 22.19), gerador de carga e Postgres (`postgis/postgis:16-3.4` no Docker Desktop, configuração padrão: `shared_buffers` ~160 MB, `max_connections` 100) **na mesma máquina**, por loopback. Os números mostram o comportamento relativo e o antes/depois, e não o de uma VPS de produção.
- **Banco:** só de carga (`kernelpanic_carga`), com as migrations da `main`. O script recusa rodar em banco cujo nome não tenha `carga`.
- **Gerador** (`teste-carga/teste-carga-http.ts`): carga **aberta**, em degraus de taxa (requisições por segundo, 15 s por degrau, mais 15 s de aquecimento fora da medição). As requisições saem no ritmo do degrau mesmo que a API atrase, como numa frota real. Cada requisição leva a leitura de 6 sensores de uma de 2.000 estações (a chave da ingestão é conferida normalmente).
- **Perda de pacotes:** 202 recebidos menos leituras que chegaram a `leituras_brutas`, depois de esperar o buffer da API gravar. Também se confere que `medidas` tem 6 linhas por leitura.
- **Sustentado:** o degrau em que p95 ≤ 2 s, sem erros, sem perda e com a taxa efetiva em pelo menos 95% do alvo.

## Resultados da ingestão (HTTP)

Todos com 202 em 100% das respostas e **perda zero**, salvo onde indicado.

| Taxa alvo (req/s) | Antes: p95 (ms) | Só `JOIN`: p95 (ms) | `JOIN` + auditoria + índice: p95 (ms) |
| ---: | ---: | ---: | ---: |
| 200 | 57 | 44 | — |
| 400 | 262 | 214 | 200 |
| 600 | — | 281 | — |
| 800 | **4.967** (efetiva 729) | 1.789 | **314** |
| 900 | — | — | 348 |
| 1.000 | — | 4.077 (efetiva 873) | **672** |
| 1.100 | — | — | 2.736 (efetiva 1.096) |
| 1.600 | 5.411 (efetiva 705) | — | — |

A terceira coluna junta as três mudanças; o degrau de 400 req/s dela foi medido antes do índice, e os demais depois.

Acima do ponto de saturação a taxa efetiva se estabiliza e a latência vai para segundos, porque a fila cresce (o gerador é aberto). Entre execuções, o p95 do degrau de 1.000 req/s variou de 0,67 s a 1,33 s, por isso o pico é dado como ~1.000 req/s, e não como um número exato.

**Rodada contínua** (80% do pico): **800 req/s por 120 s, com 5.000 estações**: 95.998 de 95.998 requisições 202, 0 erros, 0 perda, p50 69 ms, p95 332 ms, p99 376 ms, máximo 431 ms.

## O que mudou

### Gargalo: CPU da API, não o banco
Durante os degraus saturados o processo Node da API usa mais de 100% de um núcleo (a thread única do event loop), enquanto o Postgres fica em 60 a 90% de um núcleo e a máquina tem 12. O perfil do V8 (`node --prof`) mostrou o tempo concentrado em chamadas de sistema de escrita em socket (do cliente `pg` e do `http`), e muito pouco em JavaScript: o que pesa é o número de idas ao banco por requisição.

### 1. Auditoria de acesso em cada telemetria (defeito)
O `AuditoriaAcessoMiddleware` tem um desvio para `/ingestao`, mas ele nunca funcionava: aplicado com `forRoutes('*')`, o `request.path` dentro do middleware chega sem o prefixo que casou (`'/'`), então o `startsWith('/ingestao')` falhava, e a linha de auditoria era gravada no evento `finish` (quando o path já voltou ao normal). Resultado: **cada POST do datalogger fazia um INSERT em `logs_auditoria`**: 155.841 linhas `acesso.http` para `/ingestao/telemetria` no banco de carga depois de poucas execuções. O teste unitário simulava `path: '/ingestao/telemetria'`, que não é como o Express entrega a requisição, e por isso nunca pegou. A correção usa `originalUrl`, e há teste unitário com o path cortado e teste funcional com o Express de verdade.

### 2. Uma consulta só para a estação
`IngestaoService.ingerir` carregava a estação, os parâmetros e os tipos com o carregamento de relações padrão do Prisma (consultas separadas). Com `relationLoadStrategy: 'join'` (preview `relationJoins` no gerador) vira uma consulta. Isoladamente, subiu o pico sustentado de 400 para 800 req/s.

### 3. Índice em `medidas(unixtime)`
Ver a próxima seção. Não alterou o pico da ingestão (continua ~1.000 req/s com o índice).

## Armazenamento de séries temporais

Banco com **9,99 milhões de medidas** (5.000 estações × 6 parâmetros, 1 por minuto, ~5,5 horas), em ordem cronológica de chegada, como a ingestão as grava. Tabela de 1.593 MB; índices atuais de ~2 GB (chave primária 768 MB, `(parametroId, unixtime)` único 1.138 MB, `(estacaoId, unixtime)` 316 MB). Consultas no padrão do dashboard (`dashboard.service.ts`: janela de tempo, ordenada por `unixtime`, até 5.000 linhas), medianas de 3 execuções, cache quente. SQL em `kernelpanic-backend/teste-carga/armazenamento-series.sql`.

| | Sem índice novo | btree `(unixtime)` | BRIN `(unixtime)`, `pages_per_range=32` |
| --- | ---: | ---: | ---: |
| **Q1** todas as estações, última hora, `ORDER BY unixtime LIMIT 5000` | 1.302 ms | **16,8 ms** | 1.251 ms |
| **Q2** uma estação, últimas 6 h | 11,7 ms | 10,7 ms | 11,4 ms |
| **Q3** `count(*)` na última hora | 1.257 ms | 1.125 ms | 1.149 ms |
| Tamanho do índice | — | 70 MB | 256 kB |
| Tempo para criar o índice (10 milhões de linhas) | — | 3,7 s | 3,5 s |
| Inserir 510 mil linhas (3 índices atuais + o novo) | 26,0 s | 28,7 s (+10%) | 28,1 s (+8%) |

- **btree aplicado.** A consulta sem filtro de estação (dashboard geral) é a única que nenhum índice atual atende, e passa de 1,3 s para 17 ms (77×). O índice é pequeno (70 MB, porque o Postgres deduplica as chaves repetidas: 30 mil medidas por instante) e custa cerca de 10% de gravação.
- **BRIN descartado.** O BRIN só guarda mínimo e máximo por faixa de páginas, então não entrega ordem: o Postgres lê toda a janela (700 mil linhas) e ordena, e o tempo não muda. Seu único ganho é o tamanho (256 kB), irrelevante diante dos 70 MB do btree.
- **Q3** (`count` sobre 700 mil linhas) não melhora com nenhum índice, porque precisa ler a janela inteira. Se isso virar necessidade, o caminho é pré-agregar (por exemplo, uma tabela de resumo por hora), e não um índice.
- **Particionamento não foi aplicado.** `medidas` tem chave primária só em `id` e `alarmes.medidaId` é chave estrangeira para ela; numa tabela particionada, toda chave única precisa incluir a coluna de partição, o que mudaria a chave primária para `(id, unixtime)` e quebraria essa chave estrangeira e o `@id` do Prisma. O ganho para consulta já vem do índice. O benefício principal do particionamento, descartar dados antigos por partição, não é uma necessidade hoje.
- **Em produção, tabela já grande:** a migration cria o índice dentro de uma transação, o que trava as gravações enquanto ele é construído (3,7 s com 10 milhões de linhas aqui). Se a tabela for muito maior, crie antes, fora da migration, com `CREATE INDEX CONCURRENTLY medidas_unixtime_idx ON medidas (unixtime)`.

## Limites desta medição

- API, gerador e banco disputam a mesma máquina (12 threads), e o Postgres roda em Docker Desktop. Em Linux e em máquinas separadas, as chamadas de sistema custam menos, e o pico tende a ser maior.
- Um processo Node usa um núcleo. Para passar de ~1.000 req/s, o caminho é rodar mais instâncias da API atrás de um balanceador (o buffer em lote é por instância).
- O 202 é devolvido antes de gravar (o lote é gravado a cada ~2 s ou com 5.000 itens). "Sem perda" aqui quer dizer que tudo que foi aceito chegou ao banco com a API de pé; a perda em queda do processo é tratada na SCRUM-38.
- Ainda sobra trabalho por requisição no caminho: o guard da chave e o serviço consultam a mesma estação duas vezes (uma só poderia bastar). Não foi feito: encostaria em `ingestao.service.ts`, que as SCRUM-38, 40 e 41 também alteram.

## Como rodar

```bash
# banco só de carga, com as migrations
createdb kernelpanic_carga      # ou CREATE DATABASE kernelpanic_carga
DATABASE_URL="postgresql://…/kernelpanic_carga?schema=public" npx prisma migrate deploy

# API apontando para esse banco (em outro terminal)
npm run build
DATABASE_URL="postgresql://…/kernelpanic_carga?schema=public" node dist/main.js

# escada de carga (padrão: 2000 estações; degraus 50…1600 req/s; 15 s cada)
DATABASE_URL="postgresql://…/kernelpanic_carga?schema=public" npm run teste:carga:http

# um degrau só, mais longo (carga contínua)
TAXAS=800 DURACAO_POR_TAXA=120 NUM_ESTACOES=5000 npm run teste:carga:http
```

Variáveis: `URL_API` (padrão `http://localhost:3001`), `NUM_ESTACOES`, `TAXAS`, `DURACAO_POR_TAXA`, `LIMITE_P95_MS` (2000), `TIMEOUT_MS` (10000), `MAX_EM_VOO` (3000; acima disso o gerador descarta e conta como "descartada no gerador").
