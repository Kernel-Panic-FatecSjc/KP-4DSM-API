# Transmissão da telemetria (firmware ESP32, Arduino / C++)

Alternativa em Arduino à versão em C do ESP-IDF (`../transmissao`). Mesma lógica e mesmas regras.
Monta e envia as leituras para `POST /ingestao/telemetria`, no formato do `IngerirTelemetriaDto`
(`kernelpanic-backend/servicos/ingestao/http/dto/ingerir-telemetria.dto.ts`).
Copie a pasta para `libraries/` do Arduino (ou `lib/` do PlatformIO).

| Arquivo | O que faz |
| --- | --- |
| `src/payload_telemetria.h` | Monta o JSON: `vid`, `unixtime`, `latitude`, `longitude`, `leituras` |
| `src/classificar_resposta.h` | Classifica a resposta da API |
| `src/TransmissaoHttp.h` | Acerta o relógio por NTP, envia por HTTP(S) com o header `x-chave-estacao` e reenvia em falha transitória |
| `test/teste_transmissao.cpp` | Testes que rodam no computador |

## Payload

```json
{ "vid": "A4:CF:12:9B:77:01", "unixtime": 1792869809, "latitude": -23.1896, "longitude": -45.8841,
  "leituras": { "temperatura": 24.6, "umidade": 61.2 } }
```

- Os nomes em `leituras` precisam ser os dos tipos de parâmetro da estação (`GET /ingestao/estacoes/{vid}/parametros` lista).
- `unixtime` vem do relógio acertado por NTP; sem ele (relógio ainda em 1970) o campo fica de fora e a API usa o momento do recebimento.
- `latitude` e `longitude` vêm da configuração (posição fixa da estação).
- Leitura com valor `NaN` (falha do sensor) ou nome fora do padrão da API não entra no pacote.

## Respostas

| Resposta | Resultado | O que o firmware faz |
| --- | --- | --- |
| 202 | `SUCESSO` | Leitura entregue |
| 400, 401, 404 | `ERRO_PERMANENTE` | Registra no Serial e não reenvia |
| 5xx, timeout, sem conexão | `ERRO_TRANSITORIO` | Reenvia o mesmo pacote até `tentativasMax`; se esgotar, a leitura continua com quem chamou, para o buffer |

Qualquer outro código não documentado para a rota também é tratado como transitório.

## Uso

```cpp
#include <TransmissaoHttp.h>
using namespace transmissao;

ConfigTransmissao cfg;  // preencher no setup()
// cfg.urlBase = "https://api.exemplo.com.br";
// cfg.vid = "A4:CF:12:9B:77:01";
// cfg.chaveEstacao = "<chave da estação>";   // não versionar
// cfg.local = {true, -23.1896, -45.8841};
// cfg.certificadoRaiz = <PEM da CA do servidor>;

// depois de conectar no Wi-Fi:
sincronizarRelogio();

ResultadoEnvio r = enviarTelemetria(cfg, unixtimeAgora(), {{"temperatura", t}, {"umidade", u}});
if (r == ResultadoEnvio::ERRO_TRANSITORIO) { /* guardar no buffer */ }
```

## Testes no computador

```bash
cd firmware/transmissao-arduino/test
g++ -std=c++17 -Wall -Wextra -I../src teste_transmissao.cpp -o teste && ./teste
```
