# Teste de carga da ingestão

Medições da cadeia de dados sob carga. A meta do plano de QA é **p95 abaixo de 2 s, sem perda de pacotes**.

- [Cadeia nova: broker → ingestão → tratamento](#cadeia-nova-broker--ingestão--tratamento-outubro2026) (outubro/2026): o caminho atual, depois da separação em serviços ([docs/mqtt-topico-payload.md](mqtt-topico-payload.md)). Substitui o TODO da SCRUM-43: as regras de retry, faixa física e estação inativa (SCRUM-38/40/41) estão todas no caminho medido.
- [Ingestão HTTP no monólito](#medição-anterior-ingestão-http-no-monólito-scrum-43) (SCRUM-43): a medição anterior, com a API recebendo a telemetria e gerando as medidas na hora. Fica como histórico.

## Cadeia nova: broker → ingestão → tratamento (outubro/2026)

### Resumo

| | Resultado |
| --- | --- |
| Maior taxa sustentada (p95 de ponta a ponta ≤ 2 s, sem erro nem perda) | **1.000 mensagens/s** (6.000 medidas/s) |
| p95 de ponta a ponta a 1.000 msg/s (publicação → medida no banco) | **551 ms** (p50 428 ms, máx. 610 ms) |
| Confirmação do broker (PUBACK) | p95 de 1 ms em todos os degraus |
| Perda | **zero** em todos os degraus, inclusive acima do pico |
| Ingestão fora do ar | 500 mensagens publicadas com a ingestão parada chegaram todas (`leituras_brutas` e `medidas`) cerca de 1 s depois de ela voltar |
| Rota HTTP alternativa (só grava `leituras_brutas`) | 500 req/s com p95 de 5 ms e perda zero |

Em frota: 1.000 mensagens/s equivalem a 60 mil estações enviando a cada 1 minuto. A meta de p95 < 2 s foi atingida com folga e sem perda. O critério do guia da sprint ("a leitura aparece em `leituras_brutas` e em `medidas` em até 2 s") vale também com o sistema parado: 290 ms do publish à medida.

### Ambiente e método

- **Máquina:** AMD Ryzen 5 PRO 4650G (12 threads), 15,4 GB de RAM, Linux (Fedora). Broker (Mosquitto 2.0.21 com dynamic-security, em contêiner Podman), Postgres (`postgis/postgis:16-3.4` em Docker), serviço de ingestão, serviço de tratamento e o gerador **na mesma máquina**, por loopback. Os números mostram o comportamento da cadeia, e não o de VPS separadas.
- **Banco:** só de carga (`kernelpanic_carga`), com as migrations da `main`. O script recusa rodar em banco cujo nome não tenha `carga`.
- **Gerador** (`teste-carga/teste-carga-mqtt.ts`): 1.000 estações, **cada uma com a própria conexão MQTT e credencial** (cadastradas no broker como o backend faz), publicando com QoS 1 no próprio tópico. Carga **aberta** em degraus de taxa (15 s por degrau, mais um aquecimento fora da medição): as mensagens saem no ritmo do degrau mesmo que a cadeia atrase. Cada mensagem traz 6 sensores, todos configurados na estação.
- **Ponta a ponta:** em 1 de cada 10 mensagens, o gerador consulta o banco a cada 50 ms até a medida daquela estação e daquele `unixtime` existir. A latência inclui o lote da ingestão (250 ms), o aviso ao tratamento e a transação dele.
- **Perda:** publicadas x `leituras_brutas` x leituras que viraram 6 medidas, contadas no fim, depois de a cadeia esvaziar.
- **Sustentado:** p95 de ponta a ponta ≤ 2 s, sem erros, todas as amostras viraram medida, nada perdido e a taxa efetiva em pelo menos 95% do alvo.

### Resultados

| Taxa alvo (msg/s) | Taxa efetiva | PUBACK p95 (ms) | Ponta a ponta p50 (ms) | p95 (ms) | p99 (ms) | máx (ms) | Publicadas | `leituras_brutas` | Leituras com medidas | Perda |
| ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| 100 | 100 | 1 | 219 | 336 | 350 | 358 | 1.499 | 1.499 | 1.499 | 0 |
| 500 | 500 | 1 | 312 | 438 | 563 | 704 | 7.499 | 7.499 | 7.499 | 0 |
| 1.000 | 1.000 | 1 | 428 | **551** | 584 | 610 | 14.999 | 14.999 | 14.999 | 0 |
| 1.500 | 1.500 | 1 | 4.045 | 6.658 | 6.913 | 7.081 | 22.497 | 22.497 | 22.497 | 0 |

A 1.500 msg/s o broker continua confirmando em 1 ms e nada se perde, mas a fila cresce depois dele: a medida chega com segundos de atraso e a cadeia só esvazia depois que a carga para. Não isolei se o teto é a ingestão ou o tratamento (os dois disputam a CPU da mesma máquina com o broker, o Postgres e o gerador).

**Rota HTTP** (`teste-carga-http.ts`, agora contra o serviço de ingestão), um degrau de 500 req/s por 10 s com 1.000 estações: 4.999/4.999 respostas 202, p50 3 ms, p95 5 ms, p99 14 ms, perda zero e todas as medidas geradas pelo tratamento. O p95 caiu de 200 a 300 ms (medição antiga) para 5 ms porque a rota não consulta mais os parâmetros nem monta medidas: só põe o pacote no lote.

### Limites desta medição e próximos passos

- Tudo na mesma máquina. Separados em VPS, cada serviço tem a CPU só para ele, mas ganha a latência de rede entre ingestão, banco e tratamento.
- O tratamento é um processo, e duas instâncias se revezam no mesmo marcador (`SELECT … FOR UPDATE`), sem dividir o trabalho. Se a frota passar do pico medido, o caminho é aumentar o lote (`TRATAMENTO_LOTE_TAMANHO`) e medir de novo; dividir a fila por estação é a mudança seguinte.
- A ingestão confirma a mensagem ao recebê-la; num `kill -9` ou queda da máquina perde no máximo um intervalo de lote (250 ms). No encerramento normal nada se perde (ver [garantias](mqtt-topico-payload.md#garantias)).
- Uma rodada só por degrau. Entre execuções da medição antiga o p95 variou até 2×; a folga daqui (551 ms contra 2 s) cobre isso.

### Como rodar

```bash
cd kernelpanic-backend
docker compose up -d broker postgres
createdb kernelpanic_carga      # ou CREATE DATABASE kernelpanic_carga
export DATABASE_URL="postgresql://…/kernelpanic_carga?schema=public"
npx prisma migrate deploy
npm run build:servicos
npm run start:ingestao          # em outro terminal, com o mesmo DATABASE_URL e MQTT_*
npm run start:tratamento        # em outro terminal, com o mesmo DATABASE_URL

# escada de carga (padrão: 1.000 estações; degraus 100…1500 msg/s; 15 s cada)
npm run teste:carga:mqtt
# um degrau só, mais longo
TAXAS=1000 DURACAO_POR_TAXA=120 npm run teste:carga:mqtt

# rota HTTP alternativa (URL_API padrão: http://localhost:3002, o serviço de ingestão)
npm run teste:carga:http
```

Variáveis do teste MQTT: `MQTT_URL`, `MQTT_ADMIN_USUARIO`/`MQTT_ADMIN_SENHA` (para cadastrar as estações no broker), `NUM_ESTACOES`, `TAXAS`, `DURACAO_POR_TAXA`, `LIMITE_P95_MS` (2000), `AMOSTRA` (10), `INTERVALO_SONDAGEM_MS` (50).

---

# Medição anterior: ingestão HTTP no monólito (SCRUM-43)

Medição do `POST /ingestao/telemetria` quando a ingestão ainda era um módulo da API e gerava as medidas na hora, e do armazenamento de séries temporais. Os números de armazenamento (índice em `medidas(unixtime)`) continuam valendo. Os comandos de "Como rodar" desta seção são da época (a API recebia a telemetria); para rodar hoje, use os da seção acima.

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
