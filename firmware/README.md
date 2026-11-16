# Firmware do Data Logger (ESP32, C)

Firmware exclusivamente em C com PlatformIO e ESP-IDF. O dispositivo conecta ao Wi-Fi, sincroniza o relógio por NTP, autentica no broker MQTT e publica telemetria na fila persistente SPIFFS. A aquisição da bancada está configurada para DHT22 (GPIO14) e TEMT6000 (GPIO32), sem inventar leituras quando algum sensor falha.

## Configuração local

Na pasta `firmware`, copie `include/secrets.example.h` para `include/secrets.h` (se ainda não existir) e preencha:

- `WIFI_SSID` e `WIFI_PASSWORD`: rede usada pelo ESP32;
- `STATION_VID`: identificador da estação cadastrada no Data Panic;
- `STATION_KEY`: chave de ingestão da estação;
- `MQTT_HOST` e `MQTT_PORT`: endereço e porta do broker.
- `INGESTION_API_HOST` e `INGESTION_API_PORT` são opcionais para consultar os parâmetros cadastrados. O padrão é `MQTT_HOST:3002`; defina os dois se a ingestão estiver em outro endereço.

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

`mqtt_manager_publish_telemetry()` aceita de 1 a 50 leituras nomeadas e persiste o JSON UTF-8 antes de tentar publicar no tópico `estacoes/{STATION_VID}/telemetria`, com QoS 1 e `retain` desativado. O payload guarda o horário Unix da leitura e o objeto `leituras`; latitude e longitude são incluídas quando fornecidas. Quando não são fornecidas, a ingestão usa a localização cadastrada para a estação.

Cada nome deve corresponder a um parâmetro cadastrado para a estação, e valores não numéricos, nomes inválidos ou duplicados são recusados. Se o MQTT estiver desconectado, o payload permanece na fila local. O item só é removido após o `MQTT_EVENT_PUBLISHED` correspondente (PUBACK QoS 1), que confirma o broker, não a gravação no banco nem a chegada à tela.

O chamador deve passar leituras reais do sensor e respeitar o intervalo configurado. Para facilitar testes e apresentações, a aplicação está temporariamente em 30 s; para operação nominal de cinco minutos, altere `APP_SENSOR_SAMPLE_INTERVAL_MS` em `main/app_main.c` para `300000U`. A aquisição e o agendamento pertencem à etapa de leitura dos sensores; esta implementação não inventa nem publica leituras de teste.

## Fila persistente e recuperação

`telemetry_queue` armazena cada payload como arquivo independente na partição SPIFFS `telemetry`, antes da publicação. Após reinício, a fila é percorrida em ordem crescente do identificador persistido. O firmware mantém um item MQTT em voo por vez; um PUBACK remove somente o item correspondente. QoS 1 pode repetir publicação, então a deduplicação da plataforma continua necessária.

A fila persistente é FIFO limitada a 1.024 itens e ao espaço livre da partição SPIFFS (2.801.411 bytes úteis observados nesta placa). Se atingir qualquer limite, rejeita a nova leitura e preserva as já enfileiradas; não apaga a mais antiga. O limite de itens representa até 8 h 32 min no intervalo temporário de 30 s ou até 3 dias e 13 h 20 min no intervalo nominal de 5 min; payloads grandes podem reduzir esses períodos. Não há expurgo automático por idade. Esta é a política adotada para SCRUM-34 e ainda precisa ser exercitada em bancada até o limite.

O MQTT é aberto sob demanda: quando há itens na fila, o cliente conecta ao broker, publica um por vez e espera PUBACK; quando a fila esvazia, envia DISCONNECT. Uma falha de rede mantém os itens na fila, e o firmware tenta novamente com espera exponencial de 1 a 60 s. O cliente ESP-MQTT não faz reconexão autônoma; o worker da fila decide quando chamar reconexão, evitando manter a sessão ociosa entre amostras. O timeout de transporte é 5 s. A política de conexão sob demanda ainda precisa ser confirmada na placa.

## Amostragem dos sensores

`sensor_manager` é extensível e oferece fontes ADC1, nível digital GPIO, pulsos de pluviômetro/anemômetro e DHT22 (temperatura e umidade). Cada sensor físico tem uma associação local explícita a um nome de parâmetro e pino/canal, pois a API de parâmetros não fornece pinagem nem protocolo elétrico. Ao iniciar, o firmware consulta `GET /ingestao/estacoes/{vid}/parametros` com `x-chave-estacao` e aplica `fator`/`ganho` para os nomes associados. Se o serviço estiver indisponível, mantém as conversões locais e registra o erro; uma nova interface/protocolo exige um driver compatível.

## Configuração atual dos sensores de bancada

A aplicação agora inicia o DHT22 em GPIO14 e o TEMT6000 no canal ADC1_CH4/GPIO32, com período temporário de 30 s para testes/apresentações. As leituras configuradas são `temperatura_c` (°C), `umidade_pct` (%RH) e `luminosidade_adc` (contagem ADC bruta de 0 a 4095). O DHT22 informa temperatura e umidade em décimos; o driver converte para °C e %RH, conforme o [manual técnico AM2302 da Aosong](https://www.aosong.com/uploadfiles/2025/04/20250417105409216.pdf). Os fatores são 1 e os ganhos 0; o valor do TEMT6000 permanece como contagem bruta, não lux, pois a resistência/circuito de conversão e a calibração de lux não foram informados.

Cadastre esses nomes exatamente como parâmetros da estação antes de esperar medidas tratadas no backend. A alimentação máxima de 3,3 V do TEMT6000 foi informada, mas a saída analógica não foi medida. O ADC está com atenuação de 12 dB; para melhor precisão no ESP32, a faixa efetiva recomendada chega a cerca de 2,45 V. Acima disso o valor bruto pode perder precisão ou saturar; valide a tensão e o resultado no monitor serial antes de interpretar como luminosidade.

## Estado do protótipo e bloqueios

Os sensores informados são DHT22 no GPIO14 e TEMT6000 no GPIO32; consulte o [inventário e bloqueios de SCRUM-30](hardware/README.md). A pinagem foi informada para este teste, mas ainda falta esquema/continuidade verificada da carrier. O módulo azul ligado ao Módulo_4 permanece sem identificação e não será tratado como sensor nem acionado. O possível roteamento para GPIO35/RTC_GPIO5 não foi confirmado por esquema.

Nos ciclos anteriores, o firmware ainda identificava incorretamente o sensor de GPIO14 como DHT11. Portanto, valores/quadros decodificados por aquela versão não são evidência válida de temperatura ou umidade DHT22; um payload histórico foi confirmado pelo broker e deve ser tratado como inválido caso tenha chegado à ingestão. O driver atual usa o formato DHT22 e precisa ser validado em nova gravação. O TEMT6000 teve contagens ADC observadas entre 32 e 1.296; ainda não há conversão/calibração em lux. A fila persistente remove itens após PUBACK do broker, que não confirma gravação no backend.

Leituras ADC com erro ou fora da faixa configurada são ignoradas; detectar desconexão requer limites adequados ao sensor. O firmware genérico não inclui drivers específicos I2C/SPI. Não use valores de exemplo como calibração.

## Validação na placa

1. Confirme que `include/secrets.h` contém os dados reais da rede, estação e broker. Não compartilhe esse arquivo nem cole seus valores em logs ou mensagens.
2. Confirme a porta serial no Gerenciador de Dispositivos. Este ESP32 apareceu como `COM3`; o número pode mudar ao reconectar.
3. Execute os comandos de compilação acima. Só prossiga para o upload se a compilação terminar com `SUCCESS`.
4. Grave o firmware e abra o monitor serial. Reinicie o ESP32 se necessário.
5. Confirme no log: `conectado; endereço IP`, `relógio sincronizado` e `conexão autenticada estabelecida`.
6. Para validar reconexão, com o firmware em execução desligue e religue o ponto de acesso Wi-Fi; depois faça o mesmo com o broker, se puder controlar esse serviço. Confirme as mensagens de desconexão e a reconexão. Encerre o monitor com `Ctrl+C`.

Para SCRUM-35, siga o [roteiro ponta a ponta](hardware/SCRUM-35-roteiro.md) e anexe logs e consultas reais. O roteiro não substitui execução nem constitui evidência de teste.

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

O firmware contém MQTT, fila persistente limitada e fontes extensíveis para tipos elétricos comuns. SCRUM-30 ainda precisa demonstrar individualmente os sensores ligados; SCRUM-31 precisa do teste de reconexão; SCRUM-32 precisa de leitura válida do DHT22, valor ADC observado e comparação com referência (a tolerância numérica segue pendente); SCRUM-33 precisa confirmar recepção no broker/ingestão; SCRUM-34 precisa dos cenários de recuperação e limite da fila; SCRUM-35 precisa das evidências ponta a ponta no backend.
