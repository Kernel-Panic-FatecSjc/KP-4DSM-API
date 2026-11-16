# SCRUM-35 — roteiro de validação ponta a ponta

Este roteiro prepara a validação; os campos de resultado ficam vazios até o teste ser executado com sensor identificado, esquema confirmado e acesso ao broker/ingestão. Não registrar credenciais nem conteúdo de `secrets.h` nas evidências.

## Pré-condições

- [ ] Sensor real identificado e ligado conforme esquema revisado.
- [ ] Parâmetro cadastrado na estação e nome idêntico ao enviado em `leituras`.
- [ ] Conversão `fator`/`ganho` confirmada; constante de pulso definida quando aplicável.
- [ ] Relógio NTP válido e intervalo da estação configurado para cinco minutos na validação nominal (a aplicação está em modo temporário de teste/apresentação de 30 s).
- [ ] Firmware compilado e gravado; anotar versão/commit e porta serial sem registrar segredos.
- [ ] Broker, serviço de ingestão e tratamento disponíveis; acesso às leituras brutas e medidas.
- [ ] Capacidade física da fila SPIFFS medida e procedimento aprovado para o cenário “buffer cheio”.

## Cenários

| Cenário | Procedimento | Resultado a verificar | Evidência |
| --- | --- | --- | --- |
| Wi-Fi indisponível | Com o datalogger coletando dados reais, interromper o ponto de acesso por alguns minutos e restaurá-lo. | Leituras mantidas na fila local durante a queda; reenvio em ordem de `unixtime`; PUBACKs após retorno; pacote presente na ingestão. | Log serial, horário da queda/retorno e consulta de `leituras_brutas`/`medidas`. |
| Ingestão indisponível | Manter broker ativo e parar o subscriber/serviço de ingestão; publicar dados reais; restaurar a ingestão. | Broker mantém mensagens QoS 1 para a sessão persistente e entrega após retorno; verificar ausência de perda e duplicidade no tratamento. | Logs do broker e da ingestão, contagens e consulta de brutas/medidas. |
| Reinício com fila cheia | Só após capacidade e política de fila aprovadas: preencher até a condição de cheio, registrar IDs/quantidade, reiniciar o ESP32 e restaurar a comunicação. | Itens persistem após reinício; nenhuma remoção local anterior ao PUBACK; comportamento ao tentar enfileirar item adicional conforme política aprovada. | Log serial antes/depois, contagem de itens, consulta de brutas/medidas. |

## Registro da execução

- Execução parcial na placa em 2026-11-15, firmware gravado na COM3; build compilado com PlatformIO/ESP-IDF.
- Inicialização: tabela de partições correta, fila SPIFFS montada (`0/2801411 bytes`), Wi-Fi conectado e IP recebido.
- NTP não sincronizou durante a janela inicial de 15 s. O firmware continuou tentando e omitiu `unixtime` no payload.
- Broker `192.168.0.18:1883` expirou repetidamente; não houve PUBACK nem validação de ingestão/backend.
- A identificação do sensor em GPIO14 foi corrigida pelo usuário de DHT11 para DHT22 depois desses ciclos. Os quadros/valores então decodificados pelo firmware DHT11 não são evidência válida para o DHT22; um payload histórico chegou a receber PUBACK do broker e deve ser tratado como inválido caso tenha sido ingerido. A validação do driver DHT22 corrigido permanece pendente.
- O ADC/GPIO32 foi registrado no serial como 1296, 1203 e 1223 em amostras sucessivas; os pacotes correspondentes foram enfileirados (38 bytes quando só ADC válido).
- Após novas gravações/reinício, a fila montou com itens ainda pendentes (2.510 bytes usados antes do ciclo mais recente), evidência parcial de persistência local.
- Reconexão de Wi-Fi não foi testada; o usuário fará esse teste depois. Nenhum dado sintético foi usado.

### Registro complementar da execução ponta a ponta

- Data/hora e responsável:
- Commit do firmware:
- Sensor/modelo e parâmetro cadastrado:
- Broker/ingestão/tratamento usados:
- Capacidade observada da partição e política aprovada para fila cheia:
- Cenários executados e duração:
- Leituras publicadas, recebidas e tratadas:
- Perdas/duplicidades encontradas:
- Links/caminhos das evidências (logs e consultas):
- Resultado/aprovação do time:

## Limite da confirmação MQTT

PUBACK confirma a publicação QoS 1 no broker. Ele não prova, isoladamente, que a ingestão gravou a linha no banco. Por isso, a validação de SCRUM-35 também confere o subscriber e as tabelas/telas do backend depois da recuperação.

O roteiro foi executado parcialmente na placa; a conexão com broker/ingestão não ocorreu durante esse registro e não houve leitura válida do DHT22 com o driver correto. SCRUM-35 permanece pendente até concluir a recuperação e anexar evidências reais do backend.
