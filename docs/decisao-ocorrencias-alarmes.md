# Decisão: ocorrências de alarmes (US10, relatório de incidentes)

**Decisão:** a ocorrência (o "evento" de uma anomalia) é **calculada na consulta, no backend**, a partir dos alarmes do período, pela função `agruparOcorrencias` em `kernelpanic-backend/src/relatorios/ocorrencias.ts`. Nada é persistido numa tabela própria.

**Escopo:** SCRUM-59, usada pelo endpoint e pelo laudo do relatório de incidentes (SCRUM-60 e SCRUM-62).

## O problema

O trigger `avaliar_alertas_lote` cria **um alarme por medida** que viola o limiar de um alerta ativo. Uma chuva forte de 2 h, com a estação enviando a cada 5 min, gera cerca de 24 alarmes do mesmo alerta, sem nenhuma noção de "evento". O relatório precisa do tempo de duração da anomalia, do valor de pico e da quantidade de leituras acima do limiar.

## Regra de agrupamento (gaps-and-islands)

- Alarmes do **mesmo alerta** entram na mesma ocorrência. Como o alerta pertence a um parâmetro de uma estação, isso também fixa a estação e o parâmetro.
- Os alarmes são ordenados pelo **instante da leitura** (`medidas.unixtime`), e não por `alarmes.disparadoEm`. `disparadoEm` é o momento em que o tratamento gravou a medida e muda com um atraso da cadeia.
- Se o intervalo entre duas leituras acima do limiar passa da **tolerância**, a ocorrência fecha e a próxima abre outra. O intervalo igual à tolerância continua na mesma ocorrência.
- A tolerância padrão é de **15 minutos**, 3 envios a cada 5 min (RNF20.2). Assim, uma ou duas leituras normais no meio da anomalia, ou um pacote perdido, não partem o evento. A tolerância pode ser ajustada por consulta (`toleranciaMinutos`, de 1 a 1.440).

Para cada ocorrência:

| Campo | Cálculo |
| --- | --- |
| início / fim | Instante da primeira e da última leitura acima do limiar |
| duração | fim − início, em segundos. É 0 quando houve uma leitura só |
| valor de pico | Maior valor para `MAIOR_QUE`/`MAIOR_OU_IGUAL`, menor para `MENOR_QUE`/`MENOR_OU_IGUAL`, mais distante do limite para `IGUAL_A`/`DIFERENTE_DE` |
| leituras | Quantidade de alarmes na ocorrência |
| status | `ABERTO` se algum alarme ainda está aberto, `RESOLVIDO` só quando todos estão, `RECONHECIDO` nos demais casos |
| ações | Primeiro reconhecimento (quem e quando), última resolução (só quando todos estão resolvidos) e as observações registradas, sem repetir (SCRUM-58) |

## Por que calcular na consulta

| Critério | Na consulta (escolhida) | Tabela própria atualizada pelo trigger |
| --- | --- | --- |
| Tolerância configurável | Muda por consulta, sem reprocessar nada | Fica fixa na gravação. Mudar exige recalcular o histórico |
| Correção com dados fora de ordem | Sempre certa: o agrupamento ordena pela leitura | O trigger veria uma leitura antiga depois de uma nova e teria que fundir ou dividir ocorrências já gravadas |
| Custo no caminho da ingestão | Zero: o trigger dos alarmes não muda | Uma escrita a mais por lote, dentro da transação do tratamento, que é o caminho medido no teste de carga |
| Custo na consulta | Lê os alarmes do período (só as colunas usadas) e agrupa em memória, O(n log n) | Lê só as ocorrências |
| Testabilidade | Função pura, coberta por testes unitários com sequências conhecidas | Precisa de banco para testar |

O custo aceito é ler todos os alarmes do período a cada consulta. Com uma estação a cada 5 min, um alerta violado o tempo todo gera 288 alarmes por dia, ou cerca de 105 mil num ano. Isso cabe numa consulta indexada e no agrupamento em memória. Se o volume crescer além disso, o próximo passo é mover o mesmo cálculo para SQL com `LAG()` (window function), sem mudar a resposta da API.

## Limites conhecidos

- Uma ocorrência que atravessa a borda do período consultado aparece cortada: início ou fim são os da primeira ou da última leitura **dentro** do período.
- Os alarmes tratados antes da SCRUM-58 não têm as colunas de ação preenchidas. Para esse histórico, quem tratou o alarme continua só na trilha de auditoria (`alarmes.atualizarStatus`).
