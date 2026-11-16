# Firmware do Data Logger (ESP32, C)

Firmware exclusivamente em C, usando PlatformIO e ESP-IDF. A aplicação conecta ao Wi-Fi, sincroniza o relógio por NTP, coleta o DHT22 no GPIO14 e armazena/publica telemetria via MQTT. A leitura não é simulada: falhas do sensor não geram valores substitutos.

## Configuração local

Na pasta `firmware`, copie `include/secrets.example.h` para `include/secrets.h` e preencha rede, VID, chave da estação e broker. O arquivo `include/secrets.h` é ignorado pelo Git e não deve ser compartilhado nem adicionado ao versionamento.

O cliente MQTT usa o VID como usuário e a chave de ingestão como senha. O broker do projeto usa TCP 1883 sem TLS, apropriado apenas para desenvolvimento em rede confiável.

## Compilar e gravar

Da raiz do repositório, com PlatformIO instalado e a placa conectada:

```powershell
pio run --project-dir firmware
pio run --project-dir firmware --target upload --upload-port COM3
pio device monitor --project-dir firmware --port COM3 --baud 115200
```

O alvo configurado é `esp32dev` com flash de 4 MB. Ajuste a porta serial conforme `pio device list`.

## Telemetria

`mqtt_manager_publish_telemetry()` valida de 1 a 50 leituras numéricas nomeadas e persiste o payload antes de tentar publicá-lo no tópico `estacoes/{STATION_VID}/telemetria`, QoS 1, sem retain. O VID é obtido do tópico, não duplicado no JSON. O payload inclui `unixtime` quando o NTP já sincronizou; latitude/longitude são opcionais.

A fila SPIFFS é FIFO persistente e limitada a 1.024 itens e ao espaço da partição. Um item só é removido após PUBACK do broker; isso confirma o recebimento pelo broker, não a gravação no banco ou a exibição no backend. QoS 1 pode resultar em duplicidade, que deve ser tratada pela ingestão.

## Sensores e parâmetros

O gerenciador é extensível a fontes ADC1, GPIO digital, pulsos de pluviômetro/anemômetro e DHT22. A configuração concreta da aplicação usa somente o DHT22 no GPIO14, com saídas `temperatura_c` e `umidade_pct`. Os nomes e conversões devem corresponder aos parâmetros cadastrados na estação. O firmware consulta `GET /ingestao/estacoes/{vid}/parametros` e aplica `fator`/`ganho`; se a API estiver indisponível, usa os fatores/ganhos locais configurados, sem inventar leituras.

O intervalo está temporariamente em 30 s para teste/apresentação. O intervalo nominal documentado para operação é 300 s; a tolerância de comparação com instrumento de referência ainda depende de definição do time.

O mapa elétrico completo da carrier ainda não foi confirmado. Não habilite outros GPIOs nem associe novos sensores sem confirmar modelo, saída e pinagem. O módulo azul não identificado permanece fora da aquisição. Consulte [inventário e pendências de hardware](hardware/README.md).

## Pendências das tasks

- SCRUM-30/32: confirmar mapa elétrico, capturar leituras válidas do DHT22 e comparar com referência usando tolerância definida pelo time.
- SCRUM-31: testar recuperação após queda de Wi-Fi/broker; a reconexão Wi-Fi ainda não foi validada e o comportamento MQTT precisa de teste prolongado.
- SCRUM-33/35: confirmar entrega real na ingestão/backend, além do PUBACK do broker.
- SCRUM-34: testar recuperação e limites da fila persistente em bancada.

Não há evidência suficiente para declarar essas tasks totalmente concluídas.
