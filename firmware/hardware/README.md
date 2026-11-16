# Inventário e estado do hardware

## Componentes e configuração confirmada

| Componente | Informação confirmada | Estado no firmware |
| --- | --- | --- |
| ESP-WROOM-32 em carrier verde | Flash informada de 4 MB | PlatformIO `esp32dev`, ESP-IDF |
| DHT22 | GPIO14, pull-up, 3,3 V e GND comum | Driver DHT22, temperatura e umidade |

O sinal do DHT22 foi informado no GPIO14; ainda não há esquemático da carrier que confirme as trilhas. O firmware só configura o GPIO14 para a interface DHT22 informada. Nenhum outro pino de sensor está ativo.

## Pendências de validação

- Confirmar a pinagem no esquema ou por continuidade elétrica da carrier.
- Obter novas leituras válidas do DHT22 após gravar a versão com o driver correto.
- Comparar temperatura e umidade com instrumento de referência; a tolerância deve ser definida pelo time.
- Confirmar os nomes `temperatura_c` e `umidade_pct` cadastrados na estação e os fatores/ganhos aplicados.
- Registrar evidências de leitura individual para SCRUM-30/32 e de ingestão ponta a ponta para SCRUM-35.

## Inventário

| Quantidade | Componente | Estado |
| --- | --- | --- |
| 1 | ESP-WROOM-32 | Em uso |
| 1 | Carrier verde | Modelo/esquema pendente |
| 1 | DHT22 | Temperatura e umidade em GPIO14, pull-up informado |
| 1 | Módulo azul no Módulo_4 | Não identificado; não configurado nem acionado |

A SCRUM-30 permanece parcialmente validada até haver evidência das leituras reais e do mapa elétrico revisado.
