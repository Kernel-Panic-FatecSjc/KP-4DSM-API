# Firmware do Data Logger (ESP32, C)

Implementação das SCRUM-31 e SCRUM-33 em C, com PlatformIO e ESP-IDF. O firmware conecta o ESP32 ao Wi-Fi, sincroniza o relógio por NTP, autentica no broker MQTT, tenta restabelecer as conexões quando elas caem e disponibiliza a publicação de telemetria MQTT. O código da aplicação usa fontes `.c` e APIs nativas do ESP-IDF.

## Configuração local

Na pasta `firmware`, copie `include/secrets.example.h` para `include/secrets.h` (se ainda não existir) e preencha:

- `WIFI_SSID` e `WIFI_PASSWORD`: rede usada pelo ESP32;
- `STATION_VID`: identificador da estação cadastrada no Data Panic;
- `STATION_KEY`: chave de ingestão da estação;
- `MQTT_HOST` e `MQTT_PORT`: endereço e porta do broker.

O cliente MQTT usa o `VID` como usuário e a chave de ingestão como senha, conforme o cadastro do broker. O arquivo `include/secrets.h` é ignorado pelo Git; não publique credenciais.

## Compilar e gravar

Com PlatformIO instalado e o ESP32 conectado ao computador, execute da raiz do repositório:

```powershell
pio run --project-dir firmware --target compiledb
pio run --project-dir firmware
pio run --project-dir firmware --target upload --upload-port COM3
pio device monitor --project-dir firmware --port COM3 --baud 115200
```

O hardware alvo informado é ESP-WROOM-32, configurado como `esp32dev` no PlatformIO. A flash de 4 MB está definida em `sdkconfig.defaults`; ajuste o alvo se a equipe substituir o módulo.

O monitor serial opera a 115200 baud. Ele informa as tentativas e o estado do Wi-Fi, a sincronização do relógio e a conexão autenticada ao MQTT. `clock_sync_get_unixtime()` em `main/clock_sync.h` disponibiliza o timestamp Unix apenas quando o relógio já é válido.

O primeiro comando gera `compile_commands.json`, usado pelo IntelliSense do VS Code para localizar os headers do ESP32. Regenere-o após alterar a configuração ou as dependências do projeto. O arquivo gerado é ignorado pelo Git.

## Publicar telemetria MQTT

`mqtt_manager_publish_telemetry()` aceita de 1 a 50 leituras nomeadas e publica JSON UTF-8 no tópico `estacoes/{STATION_VID}/telemetria`, com QoS 1 e `retain` desativado. O payload usa o horário Unix obtido após a sincronização NTP e o objeto `leituras`; latitude e longitude são incluídas quando fornecidas. Quando não são fornecidas, a ingestão usa a localização cadastrada para a estação.

Cada nome deve corresponder a um parâmetro cadastrado para a estação, e valores não numéricos, nomes inválidos ou duplicados são recusados. A função retorna erro se o MQTT estiver desconectado ou o relógio ainda não estiver válido. O evento `MQTT_EVENT_PUBLISHED` registra o PUBACK do broker; isso confirma a entrega MQTT, não a gravação no banco.

O chamador deve passar as leituras reais do sensor e respeitar o intervalo de cinco minutos da estação. A aquisição e o agendamento pertencem à etapa de leitura dos sensores; esta implementação não inventa nem publica leituras de teste.

## Amostragem dos sensores

`sensor_manager` fornece uma base configurável para ADC1, pluviômetro por pulsos e anemômetro por frequência de pulsos. O timer periódico não usa `delay()` bloqueante. Para cada sensor, a configuração fornece o nome do parâmetro, a entrada física, `fator` e `ganho` obtidos de `GET /ingestao/estacoes/{vid}/parametros`; a conversão aplicada é `valor bruto × fator + ganho`. O firmware ainda não busca esse endpoint automaticamente: o chamador deverá fornecer os valores recebidos. Para sensores de pulso também deve ser informado o valor físico por pulso (chuva) ou a constante km/h por Hz (vento).

## Estado do protótipo e bloqueios

Até o momento, não há sensor ambiental identificado/configurado. O módulo azul fotografado está ligado ao conector Módulo_4, tem terminais `VCC`, `I/O` e `GND`, não apresenta modelo legível e parece ser um buzzer, não um sensor de medição. O sinal de Módulo_4 foi identificado como possivelmente GPIO35/RTC_GPIO5, mas essa ligação não foi confirmada por esquemático. GPIO35/RTC_GPIO5 é um pino de entrada, não deve ser usado para acionar o buzzer.

A aplicação inicia o gerenciador com zero sensores e mantém todos os GPIOs de aquisição desativados. Para configurar a coleta, ainda são necessários o modelo e tipo de saída do sensor ambiental, o mapeamento validado do conector para GPIO, o nome do parâmetro na estação e as constantes de conversão/calibração. A tolerância de comparação com instrumento de referência também precisa ser definida pelo time. Até essas informações e sensores reais estarem disponíveis, não haverá leitura ou publicação de telemetria.

Leituras ADC com erro ou fora da faixa configurada são ignoradas; detectar desconexão requer limites adequados ao sensor. O firmware genérico não inclui drivers específicos I2C/SPI. Não use valores de exemplo como calibração.

## Validação na placa

1. Confirme que `include/secrets.h` contém os dados reais da rede, estação e broker. Não compartilhe esse arquivo nem cole seus valores em logs ou mensagens.
2. Confirme a porta serial no Gerenciador de Dispositivos. Este ESP32 apareceu como `COM3`; o número pode mudar ao reconectar.
3. Execute os comandos de compilação acima. Só prossiga para o upload se a compilação terminar com `SUCCESS`.
4. Grave o firmware e abra o monitor serial. Reinicie o ESP32 se necessário.
5. Confirme no log: `conectado; endereço IP`, `relógio sincronizado` e `conexão autenticada estabelecida`.
6. Para validar reconexão, com o firmware em execução desligue e religue o ponto de acesso Wi-Fi; depois faça o mesmo com o broker, se puder controlar esse serviço. Confirme as mensagens de desconexão e a reconexão. Encerre o monitor com `Ctrl+C`.

O MQTT de desenvolvimento usa a porta 1883 sem TLS, portanto faça o teste somente em rede confiável. A validação de reconexão exige que o broker esteja ativo e que VID/chave correspondam a uma estação cadastrada nele.

## Versionar a task

Depois de revisar os arquivos e confirmar que `secrets.h` não será adicionado, a partir da raiz do repositório:

```powershell
git add firmware .vscode/settings.json
git diff --cached --check
git diff --cached --stat
git status --short
```

Confirme que `firmware/include/secrets.h` não aparece no status nem no diff staged. Então crie o commit na branch `feat/SCRUM-31-projeto-firmware-esp32`:

```powershell
git commit -m "feat(SCRUM-31): create ESP32 firmware foundation"
```

## Broker e escopo

O broker do repositório está configurado em TCP porta 1883, sem TLS. Essa configuração serve para desenvolvimento em uma rede confiável; não transmita credenciais por redes públicas sem habilitar TLS no broker.

O firmware implementa a base de conexão e autenticação da SCRUM-31 e a publicação MQTT QoS 1 da SCRUM-33. A publicação de leituras reais e na periodicidade configurada depende do chamador fornecer as medições obtidas pelos sensores.
