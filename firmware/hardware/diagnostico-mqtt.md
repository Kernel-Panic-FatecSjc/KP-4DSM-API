# Diagnóstico da conexão MQTT do firmware

Análise do ciclo de vida da conexão em `main/mqtt_manager.c` (ESP-IDF 5.4.0, ESP-MQTT, reconexão automática desligada) e roteiro para confirmar em bancada. As conclusões abaixo vêm da leitura do código; nenhuma foi comprovada em teste ainda.

## Como a conexão é aberta e fechada

| Situação | O que o firmware faz | Conexão no broker |
| --- | --- | --- |
| Leitura enfileirada sem conexão | `esp_mqtt_client_start()` (antes, `stop()` se o cliente já tinha sido iniciado) | Uma nova conexão TCP + CONNECT com client id fixo `datalogger-{VID}` |
| Fila esvaziou (PUBACK do último item) | `esp_mqtt_client_stop()` | O ESP-MQTT envia DISCONNECT se ainda conectado, fecha o socket e apaga o outbox |
| Falha de transporte (queda de Wi-Fi, broker fora) | O ESP-MQTT fecha o socket e emite `MQTT_EVENT_DISCONNECTED`; o firmware agenda nova tentativa com backoff de 1 s a 60 s | O broker só percebe pelo keepalive: depois de ~1,5 × 15 s registra `exceeded timeout` |
| Reconexão com o mesmo client id enquanto o broker ainda vê a sessão antiga | — | O Mosquitto encerra a conexão antiga ("already connected, closing old connection") e aceita a nova |

O dispositivo usa no máximo um socket MQTT por vez; `stop()` e a falha de transporte fecham o socket. **Pelo código, conexões antigas não ficam abertas no ESP32 nem se acumulam no broker**: no pior caso, uma sessão meio aberta dura até o timeout do keepalive ou até o próximo CONNECT com o mesmo client id. `select() timeout` é o tempo do `connect()` TCP (`network.timeout_ms = 5000`) esgotado: o SYN não teve resposta. Isso aponta para a rede (host/porta inalcançável, firewall, IP do broker alterado, isolamento de clientes no AP), não para conexões presas.

## Defeito encontrado (corrigido nesta versão)

`esp_mqtt_client_stop()` apaga o outbox do ESP-MQTT. Antes da correção, se a conexão caísse entre o publish e o PUBACK:

1. `s_inflight_message_id` continuava com o id da publicação antiga, porque nada o limpava no `DISCONNECTED`;
2. a reconexão fazia `stop()`/`start()`, e o outbox com aquela mensagem era apagado;
3. o PUBACK nunca chegava, e `publish_next_queued_telemetry()` retornava cedo para sempre ("já há item em voo");
4. a conexão nova ficava **aberta e ociosa** (a fila nunca esvazia, então o `stop()` de fila vazia nunca rodava) enquanto a fila só crescia, até o reboot.

Isso explica o acúmulo da fila relatado. A correção:

- esquece a publicação em voo em `DISCONNECTED`, em `CONNECTED`, antes de cada `stop()`/`start()` e ao parar o cliente ocioso. O item continua na fila SPIFFS e é publicado de novo;
- usa um contador de geração da conexão: um publish iniciado antes de uma queda não vira "em voo" depois dela;
- reinicia a conexão se o PUBACK não chegar em 20 s (`PUBACK_TIMEOUT_MS`);
- abandona tentativa de conexão sem `CONNECTED`/`DISCONNECTED` em 30 s (`CONNECT_ATTEMPT_TIMEOUT_MS`);
- registra no log `estatísticas MQTT: conexões=… desconexões=… pubacks=… reenvios_sem_puback=…` a cada conexão/desconexão.

Reenvio pode gerar duplicata no broker; o tratamento descarta pelo índice `parametroId + unixtime`. Por isso o firmware agora só amostra depois do primeiro sincronismo NTP e não gera pacote sem `unixtime`.

## Como confirmar em bancada

### Logs do firmware (monitor serial)

Por ciclo normal deve aparecer, nesta ordem: `abrindo conexão MQTT`, `conexão autenticada estabelecida`, `aguardando PUBACK id=…`, `PUBACK recebido; item removido`, `fila vazia; parando cliente MQTT`, `cliente MQTT parado`. Os contadores `conexões` e `desconexões`/paradas devem crescer juntos; `reenvios_sem_puback` só cresce em quedas.

### Logs do broker

Com a pilha local (`kernelpanic-backend/docker-compose.yml`, serviço `broker`, `connection_messages true`):

```bash
cd kernelpanic-backend
docker compose logs -f --since 30m broker | grep -E "datalogger-|exceeded timeout|closing old connection|closed its connection|Socket error"
```

Esperado por ciclo: `New client connected ... as datalogger-{VID}` seguido de `Client datalogger-{VID} disconnected.` (DISCONNECT limpo). `has exceeded timeout` ou `closed its connection` indicam queda sem DISCONNECT; `already connected, closing old connection` indica sessão antiga substituída. Nenhum dos dois deixa conexão presa.

Conexões TCP abertas na porta 1883 (deve haver no máximo uma do IP do ESP32; o `netstat` do BusyBox da imagem pode não estar disponível):

```bash
docker compose exec broker netstat -tn | grep ':1883'
```

No Windows, no host do Docker: `netstat -ano | findstr :1883`.

### Se aparecer `select() timeout`

1. Conferir o IP/host do broker configurado no `secrets.h` local (sem compartilhar o arquivo) contra o IP atual do host (`ipconfig`).
2. De outro dispositivo **na mesma rede Wi-Fi do ESP32**, testar a porta: `Test-NetConnection <host> -Port 1883` (PowerShell).
3. Liberar a entrada TCP 1883 no Firewall do Windows para a rede usada, se o teste falhar.
4. Verificar se o roteador/AP isola clientes (rede de convidados ou "AP isolation").
5. Observar no log do broker se chega algum `New connection from <IP do ESP32>`: se não chega nada, o problema está antes do broker.
