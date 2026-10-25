# Cadeia de dados: broker, tópico e payload MQTT

A telemetria não passa mais pelo backend. Pela [arquitetura](images/arquitetura.jpeg), cada parte é um serviço próprio, na sua VPS, todos neste repositório:

| VPS | Serviço | Onde está | O que faz |
| --- | --- | --- | --- |
| 1 | Broker MQTT (Mosquitto 2) | [`broker/`](../broker) | Recebe as publicações das estações, com usuário e ACL por estação |
| 2 | Ingestão (subscriber) | [`kernelpanic-backend/servicos/ingestao`](../kernelpanic-backend/servicos/ingestao) | Assina `estacoes/+/telemetria` e **só** grava o pacote em `leituras_brutas`. Também aceita `POST /ingestao/telemetria` (HTTP), como alternativa |
| 3 | PostgreSQL + PostGIS | — | Banco |
| 4 | Tratamento | [`kernelpanic-backend/servicos/tratamento`](../kernelpanic-backend/servicos/tratamento) | Lê `leituras_brutas` em lotes, grava `medidas` e `leituras_erro` e avança o marcador em `controle_tratamento` |
| 5 | Backend (API) | [`kernelpanic-backend/src`](../kernelpanic-backend/src) | Fora do caminho dos dados: consultas, CRUD, auditoria do dado; cadastra as estações no broker |

```
estação ──MQTT QoS 1──► broker ──► ingestão ──► leituras_brutas ──► tratamento ──► medidas ──► trigger ──► alarmes
                                     ▲                                  │
                       HTTP (alternativa)                               └──► leituras_erro
```

## Tópico

```
estacoes/{vid}/telemetria
```

- `{vid}` é o identificador da estação (UUID ou MAC), o mesmo do cadastro.
- **Uma estação só publica no próprio tópico.** No broker, cada estação é um cliente com usuário = `vid` e senha = a chave de ingestão da estação, e um papel (`estacao-{vid}`) que só permite publicar em `estacoes/{vid}/telemetria`. Publicação em outro tópico é descartada pelo broker; credencial errada é recusada na conexão.
- O código da licitação **não** vai no tópico nem no usuário: o dono do dado é decidido pelo tratamento a partir da estação (ver [regras da licitação](regras-licitacao.md#identificador-da-licitação-no-broker)).
- QoS **1**, sem `retain`.

## Payload

JSON em UTF-8, o mesmo corpo da rota HTTP sem o `vid` (que vem do tópico):

```json
{
  "unixtime": 1792869809,
  "latitude": -23.2,
  "longitude": -45.9,
  "leituras": { "temperatura": 24.3, "umidade": 61.2, "chuvaMm": 0.4 }
}
```

| Campo | Obrigatório | Regra |
| --- | --- | --- |
| `leituras` | sim | Objeto com 1 a 50 pares `"nomeDoSensor": número`. O nome é o do tipo de parâmetro cadastrado na licitação (`GET /ingestao/estacoes/{vid}/parametros` lista os da estação) |
| `unixtime` | não | Segundos, do momento da leitura no dispositivo; entre 1.000.000.000 e agora + 5 min. Sem ele, vale o momento do recebimento |
| `latitude`, `longitude` | não | Posição da leitura; sem elas, vale a do cadastro da estação |

A ingestão confere só o **formato** (é o mínimo para montar a linha de `leituras_brutas`); pacote fora do formato é recusado e registrado no log do serviço (`mensagensRecusadas` no `/saude`). As regras de negócio ficam no tratamento.

## O que o tratamento faz com cada leitura

| Situação | Resultado |
| --- | --- |
| Sensor configurado na estação e valor dentro da faixa física do tipo | `medidas` (com o `licitacaoId` da estação) e, se violar um alerta, `alarmes` |
| Mesmo sensor e mesmo `unixtime` já gravados (reenvio) | Descartado (índice único `parametroId, unixtime`), sem alarme repetido |
| Valor fora da faixa física (`valorMinimo`/`valorMaximo`) | `leituras_erro` com `ABAIXO_DO_MINIMO`/`ACIMA_DO_MAXIMO`; **só essa leitura** é descartada, não o pacote (regra aceita pelo PO) |
| Sensor sem parâmetro na estação | `leituras_erro` com `SENSOR_NAO_CONFIGURADO` |
| `vid` sem estação (só possível pela rota HTTP aberta em desenvolvimento) | `leituras_erro` com `ESTACAO_NAO_CADASTRADA` |
| Estação inativa (ou da licitação encerrada) | Fica só em `leituras_brutas` |

O pacote original continua intacto em `leituras_brutas` em todos os casos.

## Garantias

- **Sem perda com a ingestão fora do ar:** a ingestão conecta com `clientId` fixo e sessão persistente (`clean: false`); o broker guarda as mensagens QoS 1 da assinatura enquanto ela está fora (até 1 milhão por cliente, `max_queued_messages`) e grava a fila em disco (`persistence`). Testado: 500 mensagens publicadas com a ingestão parada chegaram todas a `leituras_brutas` e `medidas` cerca de 1 s depois de ela voltar.
- **Broker reiniciado:** a fila da ingestão parada sobrevive a um restart do broker (gravada em disco no autosave e no encerramento). O `broker/iniciar.sh` repassa o sinal do `docker stop` ao Mosquitto e espera ele terminar de gravar antes de sair. Testado: 300 mensagens publicadas com a ingestão parada, broker reiniciado, todas chegaram.
- **Encerramento normal (SIGTERM):** a ingestão desconecta do broker, espera as mensagens recebidas entrarem no lote e grava o lote antes de sair. O MQTT.js confirma (PUBACK) cada mensagem ao recebê-la: confirmar só depois de gravar serializaria a fila. A janela que sobra é o lote em memória, no máximo `INGESTAO_LOTE_INTERVALO_MS` (250 ms), que só se perde num `kill -9` ou queda da máquina.
- **Tratamento sem buracos:** cada leitura bruta guarda o xid da transação que a gravou (`xidTransacao`). O tratamento só lê leituras de transações já terminadas (abaixo do `xmin` do snapshot) e anda com o marcador `(ultimoXid, ultimaLeituraId)`, na mesma transação em que grava as medidas. Uma gravação que comita depois de outra mais nova não fica para trás, mesmo com mais de uma instância da ingestão. Se o lote falhar, nada dele fica gravado e ele é relido no ciclo seguinte. Duas instâncias do tratamento não pegam o mesmo lote (`SELECT … FOR UPDATE` no marcador).
- **Latência:** a ingestão grava a cada 250 ms (ou 5.000 pacotes); um trigger em `leituras_brutas` avisa o tratamento (`LISTEN leituras_brutas_novas`), que processa na hora; uma varredura a cada 1 s cobre o aviso perdido. Medido: 290 ms do publish à medida com o sistema parado, e p95 de 551 ms a 1.000 mensagens/s ([teste de carga](teste-de-carga-ingestao.md)).

## Cadastro das estações no broker

O broker usa o plugin **dynamic-security** do Mosquitto. O backend tem o usuário admin dele (`MQTT_ADMIN_USUARIO`/`MQTT_ADMIN_SENHA`) e, na mesma transação do banco:

- `POST /estacoes`: cria o papel `estacao-{vid}` e o cliente `{vid}` com a chave gerada (devolvida uma vez só na resposta);
- `POST /estacoes/:id/chave-ingestao`: recria o cliente com a chave nova (a antiga para de valer na hora);
- `PATCH /estacoes/:id` mudando o `vid`: remove o cliente antigo e apaga o hash da chave; a estação precisa de chave nova.

Se o broker não responder, a operação devolve 503 e nada é gravado. Sem `MQTT_URL` (desenvolvimento, testes), o cadastro no broker é pulado. Uma estação criada assim recebe a credencial no broker ao gerar uma chave nova.

O `broker/iniciar.sh` cria, no primeiro start (volume vazio), o admin do dynamic-security e o usuário da ingestão, que pode assinar `estacoes/+/telemetria`.

## Como rodar em desenvolvimento

```bash
cd kernelpanic-backend
docker compose up -d                 # Postgres + broker (senhas de dev do docker-compose.yml)
npx prisma migrate deploy && npm run db:seed
npm run start:dev                    # backend (porta 3001)
npm run build:servicos               # compila ingestão e tratamento (dist-servicos/)
npm run start:ingestao               # em outro terminal (porta 3002)
npm run start:tratamento             # em outro terminal (porta 3003)
npm run simulador                    # 20 estações publicando a cada 60 s (NUM_ESTACOES, INTERVALO_S)
```

Health checks: `GET :3001/saude` (backend), `GET :3002/saude` (banco, lote pendente, conexão com o broker, mensagens recusadas), `GET :3003/saude` (último ciclo e leituras pendentes de tratamento).

Fora desta sprint: backup e fila em arquivo na ingestão quando o banco está indisponível (o desenho vai mudar). Hoje, com o banco fora, o lote volta para nova tentativa até `INGESTAO_LOTE_TENTATIVAS_MAX` e depois é descartado com log trazendo os itens.
