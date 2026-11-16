# SCRUM-35 — roteiro de validação ponta a ponta

## Pré-condições

- [ ] DHT22 identificado, ligado ao GPIO14 e alimentação/pull-up confirmados.
- [ ] `temperatura_c` e `umidade_pct` cadastrados na estação com fator/ganho confirmados.
- [ ] Firmware compilado e gravado; registrar versão e porta, sem credenciais.
- [ ] NTP, broker, subscriber/ingestão e backend disponíveis.
- [ ] Procedimento e capacidade da fila persistente revisados antes de simular fila cheia.

## Cenários e evidências

| Cenário | Verificação | Evidência |
| --- | --- | --- |
| Operação normal | Leituras reais do DHT22 aparecem no monitor, no broker e na ingestão/backend; conferir horário e parâmetros. | Log serial, log broker e consulta de dados brutos/medidas. |
| Queda/retorno de Wi-Fi ou broker | Leituras coletadas durante a falha permanecem na fila e são reenviadas após recuperação; conferir PUBACK e backend. | Horários da falha/retorno, IDs da fila e consultas no backend. |
| Reinício com fila pendente | Itens persistem após reinício e saem somente após PUBACK; não preencher a fila sem procedimento aprovado. | Logs antes/depois e registros recebidos. |

## Evidência já observada

Em execuções anteriores houve sincronização NTP e publicações MQTT QoS 1 com PUBACK. Também foram observadas leituras de temperatura/umidade, mas o firmware então decodificava o GPIO14 como DHT11, embora o componente tenha sido identificado pelo usuário como DHT22. Esses valores antigos não comprovam leituras corretas do DHT22. O código foi corrigido para o protocolo DHT22; precisa ser gravado e validado novamente.

O usuário relatou falhas posteriores de conexão MQTT (`select() timeout`) e acúmulo de fila. A causa de rede ainda não foi conclusivamente identificada. O teste de reconexão do Wi-Fi foi deixado para execução posterior pelo usuário. Não há evidência suficiente de ingestão ponta a ponta para concluir SCRUM-35.

## Registro da próxima execução

- Data/hora e responsável:
- Versão do firmware:
- Parâmetros cadastrados e fatores/ganhos:
- NTP e endereço IP recebidos:
- Leituras vistas no monitor:
- Conexão/publicação/PUBACK no broker:
- Registros confirmados na ingestão/backend:
- Cenários de falha e recuperação executados:
- Duplicidades/perdas encontradas:
- Links/caminhos das evidências:
- Resultado/aprovação do time:

PUBACK confirma publicação no broker. A confirmação da persistência no backend exige evidência separada da ingestão e da consulta de dados.
