# Firmware do Data Logger (ESP32, C)

Firmware exclusivamente em C, com PlatformIO e ESP-IDF 5.4. O Data Logger conecta ao Wi-Fi, sincroniza o relógio por NTP, lê o DHT22 no GPIO14 em intervalo fixo, guarda cada leitura numa fila persistente e a publica via MQTT no tópico da estação. Falhas do sensor não geram valores substitutos.

Hardware, lista de materiais e esquema elétrico: [hardware/README.md](hardware/README.md). Roteiro de validação ponta a ponta: [hardware/SCRUM-35-roteiro.md](hardware/SCRUM-35-roteiro.md). Diagnóstico da conexão MQTT: [hardware/diagnostico-mqtt.md](hardware/diagnostico-mqtt.md).

## Configuração local

Na pasta `firmware`, copie `include/secrets.example.h` para `include/secrets.h` e preencha:

| Campo | Conteúdo |
| --- | --- |
| `WIFI_SSID`, `WIFI_PASSWORD` | Rede Wi-Fi 2,4 GHz |
| `STATION_VID` | Identificador (vid) da estação cadastrada no Data Panic (UUID ou MAC) |
| `STATION_KEY` | Chave de ingestão da estação, exibida uma única vez ao cadastrar ou regenerar |
| `MQTT_HOST`, `MQTT_PORT` | Endereço do broker **na rede do ESP32** (IP do computador/servidor, não `localhost`) e porta 1883 |
| `STATION_LATITUDE`, `STATION_LONGITUDE` | Opcionais (graus decimais, as duas juntas). Sem elas a plataforma usa a localização cadastrada |
| `INGESTION_API_HOST`, `INGESTION_API_PORT` | Opcionais; padrão `MQTT_HOST:3002` |

`include/secrets.h` é ignorado pelo Git e não deve ser compartilhado nem versionado. O broker do projeto usa TCP 1883 sem TLS, adequado apenas a desenvolvimento em rede confiável.

No computador que roda broker e ingestão, libere a entrada TCP 1883 e 3002 no firewall; sem isso o ESP32 registra `select() timeout`.

## Ambientes de compilação

O intervalo e o tamanho da fila são definidos no `platformio.ini`, sem alterar o código:

| Ambiente | Intervalo | Fila | Uso |
| --- | --- | --- | --- |
| `esp32dev` (padrão) | 300 s | 1.024 leituras | Operação (periodicidade de 5 min, UC05-R1) |
| `esp32dev_demo` | 30 s | 1.024 leituras | Demonstração/apresentação |
| `esp32dev_teste_buffer` | 30 s | 10 leituras | Teste de buffer cheio (SCRUM-35); não usar em operação |

No boot o monitor serial mostra os valores efetivos (`amostragem a cada … ms` e `… itens pendentes`); confira-os depois de gravar.

## Compilar e gravar

Da raiz do repositório, com PlatformIO instalado e a placa conectada (porta em `pio device list`):

```powershell
pio run --project-dir firmware                                  # ambiente padrão (300 s)
pio run --project-dir firmware -e esp32dev --target upload --upload-port COM3
pio run --project-dir firmware -e esp32dev_demo --target upload --upload-port COM3
pio device monitor --project-dir firmware --port COM3 --baud 115200
```

Alvo: `esp32dev` (ESP-WROOM-32), flash de 4 MB, tabela de partições em `partitions.csv` (`telemetry`, SPIFFS de ~2,9 MB, guarda a fila).

## Ciclo de funcionamento

1. Inicializa NVS e a fila persistente; conecta ao Wi-Fi (reconexão automática a cada desconexão).
2. Consulta `GET /ingestao/estacoes/{vid}/parametros` e aplica `fator`/`ganho` de cada parâmetro (ver códigos abaixo).
3. Sincroniza o relógio por NTP (`pool.ntp.org`). **A amostragem só começa depois do primeiro sincronismo**: toda leitura precisa do `unixtime` do momento em que foi lida, para manter o horário original quando enviada com atraso e permitir a deduplicação.
4. A cada intervalo (timer `esp_timer`, sem delay bloqueante) lê o DHT22, aplica `valor = bruto × fator + ganho`, descarta leituras inválidas (timeout, checksum, fora da faixa do sensor) e monta o pacote.
5. Grava o pacote na fila e só então tenta publicar. A conexão MQTT é aberta sob demanda e encerrada (DISCONNECT) quando a fila esvazia.

Os estados de inicialização, Wi-Fi, NTP, conexão/autenticação MQTT e fila aparecem no monitor serial; a cada conexão/desconexão o log mostra `estatísticas MQTT: conexões=… desconexões=… pubacks=… reenvios_sem_puback=…`.

## Payload e tópico

Tópico `estacoes/{STATION_VID}/telemetria`, QoS 1, sem retain, usuário MQTT = vid, senha = chave de ingestão. O vid vem do tópico e não é repetido no JSON. Corpo (formato aceito pela ingestão, `docs/mqtt-topico-payload.md`):

```json
{"unixtime": 1795000000, "latitude": -23.1896, "longitude": -45.8841,
 "leituras": {"temperatura_c": 24.6, "umidade_pct": 61.2}}
```

| Campo | Regra no firmware |
| --- | --- |
| `unixtime` | Segundos UTC do momento da leitura; obrigatório no firmware (pacote não é gerado sem relógio sincronizado) |
| `latitude`, `longitude` | Enviados só se configurados no `secrets.h`; validados em -90…90 e -180…180 |
| `leituras` | 1 a 50 pares `"nome": número`, nomes de até 120 caracteres sem espaço nas pontas e sem repetição; os nomes precisam ser **iguais** aos tipos de parâmetro vinculados à estação |

## Confirmações e respostas tratadas

| Situação | Tratamento no firmware |
| --- | --- |
| CONNACK aceito | Conexão autenticada; envia a fila em ordem |
| Conexão recusada (credencial inválida/estação sem cadastro no broker) ou broker inacessível | Mantém a fila; nova tentativa com backoff exponencial de 1 s a 60 s. Credencial errada não se resolve sozinha: corrigir `secrets.h` |
| PUBACK do item publicado | Remove o item da fila e publica o próximo |
| Conexão cai antes do PUBACK, ou PUBACK não chega em 20 s | Mantém o item; reconecta e publica de novo (possível duplicata no broker, descartada pelo tratamento) |
| `GET …/parametros` 200 | Aplica `fator`/`ganho` dos nomes encontrados; avisa no log os nomes não cadastrados |
| `GET …/parametros` 401, 404, outro código ou timeout | Usa os fatores/ganhos locais (1 e 0) e segue coletando |

PUBACK confirma o recebimento pelo broker, não a gravação no banco. Depois do broker, a ingestão grava o pacote original em `leituras_brutas` (ou o descarta e conta em `mensagensRecusadas` no `/saude` se o formato ou o vid forem inválidos) e o tratamento gera `medidas`, `leituras_erro` e alarmes. A versão em HTTP (`POST /ingestao/telemetria`, sucesso 202) prevista no texto original da SCRUM-33 foi substituída pelo MQTT definido na US03/SCRUM-101.

## Buffer local (SCRUM-34)

| Item | Valor |
| --- | --- |
| Armazenamento | Arquivos na partição SPIFFS `telemetry` (não volátil, sobrevive a reinício e queda de energia) |
| Capacidade | 1.024 leituras (`TELEMETRY_QUEUE_MAX_ITEMS`); cada pacote tem ~70–120 bytes, então o limite é a contagem, não o espaço |
| Retenção | ~3,5 dias sem conexão a 5 min (1.024 × 5 min ≈ 85 h); ~8,5 h a 30 s |
| Ordem de envio | Cronológica (FIFO por número de sequência), com o `unixtime` original da leitura |
| Remoção | Somente após PUBACK do broker |
| Fila cheia | Descarta a leitura **mais antiga** para guardar a nova e registra `fila cheia … leitura mais antiga descartada, id=…` |
| Reenvio | Backoff exponencial de 1 s a 60 s; reinicia em 1 s a cada conexão bem-sucedida |

## Sensores e parâmetros

O gerenciador de sensores suporta ADC1, GPIO digital, pulsos de pluviômetro/anemômetro (por interrupção) e DHT22. A configuração do protótipo usa somente o DHT22 no GPIO14, com as saídas `temperatura_c` e `umidade_pct`. Pluviômetro e anemômetro não fazem parte do protótipo atual.

Cadastre na estação os tipos de parâmetro com esses nomes exatos. A **faixa física** (`valorMinimo`/`valorMaximo`) é a faixa válida do sensor, não o limite de alerta: leituras fora dela vão para `leituras_erro` e não geram medida nem alarme. Para o DHT22 use -40 a 80 °C e 0 a 100 %; configure limites de alerta só nos alertas.

### Pluviômetro e anemômetro (suportados, fora do protótipo)

As fontes de pulso usam interrupção na borda de subida (`GPIO_INTR_POSEDGE`) e contam os pulsos entre duas amostragens. A conversão, configurada em `s_test_sensors` (`main/app_main.c`), é:

| Fonte | Campos da configuração | Valor bruto por intervalo |
| --- | --- | --- |
| `SENSOR_SOURCE_RAIN_PULSE` | `input.rain.pin`, `input.rain.pull_mode`, `input.rain.millimeters_per_pulse` (> 0, da báscula do pluviômetro) | `pulsos × mm_por_pulso` (chuva acumulada no intervalo, em mm) |
| `SENSOR_SOURCE_WIND_PULSE` | `input.wind.pin`, `input.wind.pull_mode`, `input.wind.kilometers_per_hour_per_hz` (> 0, do fabricante do anemômetro) | `(pulsos ÷ segundos do intervalo) × km/h por Hz` |

Depois da conversão aplica-se `valor = bruto × fator + ganho` do parâmetro cadastrado (nomes sugeridos: `chuvaMm` e `ventoVelocidadeKmh`). Os pinos precisam ser confirmados na carrier antes de ativar qualquer fonte; GPIO6–11 são recusados; GPIO34–39 não têm pull-up interno, então exigem resistor externo.

Não habilite outros GPIOs nem associe novos sensores sem confirmar modelo, saída e pinagem. Um sensor físico novo exige declarar a fonte em `s_test_sensors` (`main/app_main.c`), recompilar e gravar.

## Pendências das tasks

- SCRUM-30: valor do pull-up, fotos da montagem e teste individual registrado ([hardware/README.md](hardware/README.md)).
- SCRUM-32: registrar a comparação com instrumento de referência; tolerância a definir pelo time.
- SCRUM-33/34/35: executar o [roteiro](hardware/SCRUM-35-roteiro.md) e anexar evidências à issue; atualizar o texto das tasks de HTTP/202 para MQTT/PUBACK.
- SCRUM-36: revisão desta documentação por outro membro do time.
