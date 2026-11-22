# SCRUM-35 — execução de 16/11/2026

Ambiente `esp32dev_demo` (amostragem a cada 30 s), firmware compilado em 16/11/2026 13:08, estação ATIVA com `temperatura_c` e `umidade_pct`. Pilha local: Postgres e broker no Docker Desktop, ingestão e tratamento em execução. Horários em UTC (local = UTC-3).

## Cenário 1 — operação normal

Log serial (trecho), um ciclo por leitura:

```
I (35597) data_logger: leitura coletada: temperatura_c=27.600
I (35597) data_logger: leitura coletada: umidade_pct=67.100
I (36167) telemetry_queue: telemetria persistida: id=q0000000000000001 bytes=102
I (36267) mqtt: abrindo conexão MQTT para enviar telemetria pendente
I (36317) mqtt: conexão autenticada estabelecida
I (36527) mqtt: publicação MQTT QoS 1 iniciada; aguardando PUBACK id=59588
I (36557) mqtt: broker confirmou publicação QoS 1 (PUBACK), id=59588
I (36557) telemetry_queue: PUBACK recebido; item removido da fila: id=q0000000000000001
I (36667) mqtt: fila vazia; parando cliente MQTT até a próxima leitura
I (36687) mqtt: cliente MQTT parado: DISCONNECT enviado (se conectado) e socket fechado
```

Após 9 ciclos: `conexões=9 desconexões=0 pubacks=9 reenvios_sem_puback=0`. Log do broker: cada ciclo registra `New client connected … as datalogger-… (p2, c1, k15 …)` seguido de `Client datalogger-… disconnected.` — conexão aberta e encerrada com DISCONNECT a cada envio, sem conexões acumuladas.

## Cenário 3a — broker fora do ar

| Evento | Horário (UTC) |
| --- | --- |
| Broker parado (`mosquitto … terminating`) | 16:56:40 |
| Broker iniciado | 17:02:25 |
| Primeiro reenvio da fila | 17:03:06 |

Durante a queda o firmware continuou coletando e persistindo (fila até `q…0b`, 11 leituras) e registrou tentativas com backoff: `select() timeout`, `erro de conexão MQTT`, `conexão MQTT encerrada; itens sem PUBACK permanecem na fila`. Após o retorno do broker, a fila foi esvaziada numa conexão de ~3 s, sem reinício do ESP32.

Consultas no banco (`unixtimeDispositivo >= 1794848100`, 16:55:00):

| Verificação | Resultado |
| --- | --- |
| Pacotes em `leituras_brutas` / leituras distintas | 23 / 22 (1 reenvio duplicado, aceitável no QoS 1) |
| Lacunas > 45 s entre leituras consecutivas | 0 — nenhuma perda |
| `medidas` por sensor (`temperatura_c`, `umidade_pct`) | 22 medidas = 22 horários distintos cada — duplicata descartada pelo tratamento |
| `leituras_erro` no período | 0 |
| Horário original preservado | Leituras de 16:56:58 a 17:02:58 recebidas entre 17:03:06 e 17:03:09, com `unixtime` da coleta (atraso de 0:11 a 6:08) |

Resultado: **aprovado** — sem perda, sem duplicidade em `medidas`, horário original mantido e reenvio automático após o retorno do broker.

## Cenários 2 e 3b — queda de Wi-Fi e ingestão fora do ar

**Ingestão fora do ar (3b):** o processo da ingestão foi encerrado (Ctrl+C) e reiniciado às 17:11:09 (`Conectado ao broker … (sessão retomada)`). Durante a parada o ESP32 continuou recebendo PUBACK do broker; as leituras de 17:10:28 e 17:10:58 ficaram retidas na sessão persistente da ingestão e foram gravadas em `leituras_brutas` às 17:11:10, logo após o reinício.

**Queda de Wi-Fi (2):** o roteador principal foi desligado e religado; enquanto reiniciava (~2 min), o ESP32 reconectou automaticamente a outro AP com o mesmo SSID (bssid 18:a6:f7:a1:14:a1, gateway 192.168.0.254), sem rota até o broker (`Host is unreachable` / `select() timeout`). As leituras seguiram a cada 30 s e foram persistidas (`q…02` a `q…05`). Ao voltar ao AP principal (bssid 94:2c:b3:e7:2a:c3, gateway 192.168.0.1) o firmware publicou as pendentes em ordem (`q…01` → `q…05`), removendo cada uma só após o PUBACK; `reenvios_sem_puback=0`, sem reinício da placa. Leituras de 17:12:28 a 17:13:58 foram gravadas entre 17:14:36 e 17:14:37 com o `unixtime` original.

Consultas no banco (`unixtimeDispositivo >= 1794848700`, 17:05:00, até a leitura de 17:18:58):

| Verificação | Resultado |
| --- | --- |
| Pacotes / leituras distintas / duplicados | 28 / 28 / 0 |
| Lacunas > 45 s | 0 — nenhuma perda |
| Leituras recebidas com atraso > 10 s | 8 (2 da parada da ingestão, 4 da queda de Wi-Fi, 2 de uma nova troca de AP às 17:15), todas com horário original |
| `medidas` por sensor | 29 medidas = 29 horários distintos (`temperatura_c` e `umidade_pct`) |
| `leituras_erro` | 0 |

Resultado: **aprovado** nos dois cenários.

Observação de rede: há dois APs com o SSID da rede de testes em redes diferentes; no AP de gateway .254 o broker é inalcançável. Recomenda-se corrigir a rede (repetidor em modo bridge ou SSID distinto) antes da apresentação.

## Cenário 4 (parcial) — reinício com fila pendente

Com o broker parado por ~6 min, o ESP32 acumulou 12 leituras e foi reiniciado (`POWERON_RESET`). Firmware `esp32dev_demo` (fila de 1.024 itens), portanto a fila **não chegou a encher**.

Após o reinício: `fila persistente pronta: 12/1024 itens pendentes` — os itens sobreviveram ao reinício. Com o broker de volta, o firmware publicou `q…01` a `q…0c` em ordem numa única conexão, removendo cada item só após o PUBACK (`pubacks=12`, `reenvios_sem_puback=0`), e retomou o ciclo normal de 30 s.

Resultado: **aprovado** para persistência e reenvio após reinício. Falta repetir com `esp32dev_teste_buffer` (fila de 10) para comprovar a política de fila cheia e conferir no banco.

## Cenário 4 — reinício com buffer cheio

Firmware `esp32dev_teste_buffer` (30 s, fila de 10), compilado em 16/11/2026 14:30. Relógio sincronizado em 17:33:38 UTC.

1. Broker parado: as leituras `q…01` a `q…0a` foram persistidas, com tentativas de conexão em backoff (`select() timeout`).
2. Na 11ª leitura: `fila cheia (10 itens): leitura mais antiga descartada, id=q0000000000000001`, seguida de `telemetria persistida: id=q000000000000000b`.
3. ESP32 reiniciado (`POWERON_RESET`) com o broker ainda parado. No boot: `fila persistente pronta: 10/10 itens pendentes`.
4. Broker religado: publicação de `q…02` a `q…0b` em ordem numa única conexão, cada item removido só após o PUBACK (`pubacks=10`, `reenvios_sem_puback=0`); depois, ciclo normal.

Conferência no banco (`unixtimeDispositivo` entre 17:31:40 e 17:41:40 UTC):

| Verificação | Resultado |
| --- | --- |
| Leitura descartada (`q…01`, 17:34:08) | Ausente em `leituras_brutas`, como esperado pela política de fila cheia |
| Leituras `q…02` a `q…0b` (17:34:38 a 17:39:08) | Todas presentes, recebidas entre 17:39:22 e 17:39:24, em ordem e com o `unixtime` original |
| Outras lacunas | Nenhuma além da leitura descartada e do intervalo de regravação do firmware (17:33:26 → 17:33:38) |
| `medidas` por sensor no período | 16 medidas = 16 horários distintos (`temperatura_c` e `umidade_pct`), sem duplicidade |

Resultado: **aprovado** — a fila cheia descarta exatamente a leitura mais antiga (registrada no log), sobrevive ao reinício e é reenviada em ordem após o retorno do broker.

## Pendentes nesta execução

- Cenário 3c (queda antes do PUBACK): janela de ~200 ms; validado em simulação do firmware, falta execução em bancada.
