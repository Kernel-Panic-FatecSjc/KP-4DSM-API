# SCRUM-35 — roteiro de teste ponta a ponta com falhas simuladas

Objetivo: comprovar com o hardware real os critérios da US03, em especial preservação local, reenvio após falha, remoção só após confirmação e ausência de perda/duplicidade em `leituras_brutas` e `medidas`. Ao final, anexar à issue os logs, prints e saídas das consultas.

## Pré-condições

- [ ] Montagem conforme [hardware/README.md](README.md); DHT22 lendo no monitor serial.
- [ ] Estação ATIVA com `temperatura_c` e `umidade_pct` vinculados; faixa física -40…80 °C e 0…100 % (faixa errada manda leituras para `leituras_erro`).
- [ ] Pilha local rodando: Postgres + broker (`docker compose up -d`), API (3001), ingestão (3002), tratamento (3003); portas 1883 e 3002 liberadas no firewall.
- [ ] Firmware gravado no ambiente indicado em cada cenário; anotar versão (linha `App version` do boot) e horário de início **em UTC**.
- [ ] Monitor serial gravando em arquivo: `pio device monitor --project-dir firmware --port COM3 --baud 115200 --filter log2file`.

Comandos de apoio (na raiz do repositório):

```powershell
$compose = "kernelpanic-backend/docker-compose.yml"
docker compose -f $compose stop broker          # broker fora do ar
docker compose -f $compose start broker
docker compose -f $compose logs --since 30m broker | Select-String "datalogger|exceeded|closed its"
curl http://localhost:3002/saude                # ingestão
curl http://localhost:3003/saude                # tratamento
```

## Cenários

Ambiente `esp32dev_demo` (30 s) nos cenários 1 a 3; `esp32dev_teste_buffer` (30 s, fila de 10) no cenário 4.

| # | Cenário | Passos | Resultado esperado | Evidências |
| --- | --- | --- | --- | --- |
| 1 | Operação normal | Deixar 5 min rodando | Cada leitura: `telemetria persistida` → `PUBACK recebido; item removido` → `cliente MQTT parado`; pacotes em `leituras_brutas` e medidas em `medidas`; telas Leituras Brutas e Dashboard mostram os dados | Log serial, consultas 1–4, prints das telas |
| 2 | Queda de Wi-Fi | Desligar o roteador/AP (ou afastar a placa) por 5 min; religar | Durante a queda: leituras continuam sendo persistidas, `Wi-Fi desconectado … tentando reconectar`. Após a volta: reconexão automática e envio em ordem; nenhuma lacuna; `atraso` grande nas leituras feitas durante a queda, com `unixtime` original | Horários de queda/retorno, log serial, consultas 1–3 |
| 3a | Broker fora do ar | `docker compose stop broker` por 5 min; `start broker` | Igual ao cenário 2 (fila no ESP32, backoff até 60 s, reenvio ao voltar); sem lacunas | Log serial com `estatísticas MQTT`, log do broker, consultas 1–3 |
| 3b | Ingestão fora do ar | Parar o `start:ingestao` (Ctrl+C) por 5 min; iniciar de novo | ESP32 continua recebendo PUBACK (broker guarda as mensagens da sessão persistente da ingestão); ao voltar, a ingestão grava tudo; sem lacunas | `/saude` da ingestão, consultas 1–2 |
| 3c | Queda antes do PUBACK | Parar o broker logo após `publicação MQTT QoS 1 iniciada`; voltar após 1 min | Fila volta a esvaziar sozinha, sem reboot; `reenvios_sem_puback` aumenta; possível duplicata em `leituras_brutas`, nenhuma em `medidas` | Log serial, consultas 1 e 4 |
| 4 | Reinício com buffer cheio | Gravar `esp32dev_teste_buffer`; parar o broker; esperar ≥ 6 min (12 leituras, fila de 10); confirmar no log `fila cheia … leitura mais antiga descartada`; reiniciar o ESP32 (botão EN ou cabo); após o boot (`10/10 itens pendentes`) iniciar o broker | Após reinício a fila continua com 10 itens; ao voltar o broker, os 10 são enviados em ordem cronológica e removidos após PUBACK; as únicas lacunas são exatamente as leituras descartadas registradas no log | Log antes/depois do reinício, ids descartados, consultas 1–3 |

Ao terminar, gravar de novo o ambiente `esp32dev` ou `esp32dev_demo`.

## Consultas de verificação

Abrir o banco com o vid, o início do teste em UTC e o intervalo em segundos:

```powershell
docker compose -f kernelpanic-backend/docker-compose.yml exec postgres psql -U kernelpanic -d kernelpanic -v vid=SEU_VID -v "inicio=2026-11-16 15:00:00" -v intervalo=30
```

```sql
-- 1) Resumo: pacotes recebidos, leituras distintas e reenvios duplicados
SELECT count(*) AS pacotes,
       count(DISTINCT "unixtimeDispositivo") AS leituras_distintas,
       count(*) - count(DISTINCT "unixtimeDispositivo") AS reenvios_duplicados
FROM leituras_brutas
WHERE "vidEstacao" = :'vid'
  AND "unixtimeDispositivo" >= extract(epoch FROM :'inicio'::timestamp);

-- 2) Perda: intervalos entre leituras consecutivas maiores que 1,5 × o intervalo
WITH t AS (
  SELECT DISTINCT "unixtimeDispositivo" AS u FROM leituras_brutas
  WHERE "vidEstacao" = :'vid'
    AND "unixtimeDispositivo" >= extract(epoch FROM :'inicio'::timestamp)
), s AS (SELECT u, lead(u) OVER (ORDER BY u) AS prox FROM t)
SELECT to_timestamp(u) AS ultima_antes, to_timestamp(prox) AS primeira_depois, prox - u AS segundos
FROM s WHERE prox - u > :intervalo * 1.5 ORDER BY u;

-- 3) Horário original preservado: momento da leitura × momento do recebimento
SELECT to_timestamp("unixtimeDispositivo") AT TIME ZONE 'UTC' AS lida_utc,
       "recebidoEm" AS recebida_utc,
       "recebidoEm" - (to_timestamp("unixtimeDispositivo") AT TIME ZONE 'UTC') AS atraso
FROM leituras_brutas
WHERE "vidEstacao" = :'vid'
  AND "unixtimeDispositivo" >= extract(epoch FROM :'inicio'::timestamp)
ORDER BY 1;

-- 4) Medidas: quantidade por sensor (deve ser igual a leituras_distintas) e duplicidade (deve vir vazio)
SELECT tp.nome, count(*) AS medidas, count(DISTINCT m.unixtime) AS horarios
FROM medidas m
JOIN parametros p ON p.id = m."parametroId"
JOIN tipos_parametro tp ON tp.id = p."tipoParametroId"
JOIN estacoes e ON e.id = m."estacaoId"
WHERE e.vid = :'vid' AND m.unixtime >= extract(epoch FROM :'inicio'::timestamp)
GROUP BY tp.nome;

SELECT m."parametroId", m.unixtime, count(*) FROM medidas m
JOIN estacoes e ON e.id = m."estacaoId"
WHERE e.vid = :'vid' AND m.unixtime >= extract(epoch FROM :'inicio'::timestamp)
GROUP BY 1, 2 HAVING count(*) > 1;

-- 5) Leituras recusadas pelo tratamento no período (nome ou faixa errados)
SELECT "nomeSensor", motivo, count(*) FROM leituras_erro
WHERE "vidEstacao" = :'vid' AND unixtime >= extract(epoch FROM :'inicio'::timestamp)
GROUP BY 1, 2;

-- 6) Alarmes duplicados para a mesma medida e alerta (deve vir vazio)
SELECT al."alertaId", al."medidaId", count(*) FROM alarmes al
JOIN medidas m ON m.id = al."medidaId"
JOIN estacoes e ON e.id = m."estacaoId"
WHERE e.vid = :'vid' AND m.unixtime >= extract(epoch FROM :'inicio'::timestamp)
GROUP BY 1, 2 HAVING count(*) > 1;
```

Critério de aprovação: consulta 2 sem lacunas (exceto, no cenário 4, as leituras descartadas registradas no log), consulta 4 com `medidas = horarios` = `leituras_distintas` e nenhuma duplicata, consultas 5 e 6 vazias. `reenvios_duplicados` > 0 na consulta 1 é aceitável (QoS 1); o que não pode é duplicar em `medidas` ou `alarmes`.

## Registro da execução

| Campo | Valor |
| --- | --- |
| Data/hora (UTC) e responsável | |
| Versão do firmware e ambiente | |
| Parâmetros cadastrados (nome, fator, ganho, faixa) | |
| Cenários executados e horários de falha/retorno | |
| Resultado das consultas 1–6 | |
| Perdas/duplicidades encontradas | |
| Evidências anexadas (logs, prints) | |
| Aprovação do time | |

Diagnóstico de conexão e interpretação dos logs do broker: [diagnostico-mqtt.md](diagnostico-mqtt.md).
