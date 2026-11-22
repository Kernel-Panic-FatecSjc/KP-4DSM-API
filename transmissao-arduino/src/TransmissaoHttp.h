// Envio HTTP(S) da telemetria para a API (ESP32, framework Arduino).
// O buffer de leituras é de quem chama: aqui se monta, envia, reenvia algumas vezes
// e classifica o resultado.
#pragma once

#include <Arduino.h>
#include <HTTPClient.h>
#include <WiFiClientSecure.h>
#include <time.h>

#include "classificar_resposta.h"
#include "payload_telemetria.h"

namespace transmissao {

struct ConfigTransmissao {
  String urlBase;       // ex.: "https://api.exemplo.com.br" (sem barra no fim)
  String vid;           // identificador da estação (o mesmo da chave)
  String chaveEstacao;  // chave de ingestão da estação (header x-chave-estacao)
  Localizacao local;    // posição fixa da estação
  const char* certificadoRaiz = nullptr;  // CA do servidor; nullptr com http://
  uint16_t timeoutMs = 10000;
  uint8_t tentativasMax = 3;       // só para falha transitória
  uint32_t esperaReenvioMs = 2000;
};

constexpr const char* CAMINHO_TELEMETRIA = "/ingestao/telemetria";
constexpr const char* HEADER_CHAVE_ESTACAO = "x-chave-estacao";

// Unix time atual em segundos, ou 0 se o relógio ainda não foi acertado.
inline int64_t unixtimeAgora() {
  const time_t agora = time(nullptr);
  return agora >= UNIXTIME_MINIMO ? static_cast<int64_t>(agora) : 0;
}

// Acerta o relógio por NTP (precisa de Wi-Fi conectado). true se conseguiu no prazo.
inline bool sincronizarRelogio(uint32_t timeoutMs = 15000) {
  configTime(0, 0, "pool.ntp.org");
  for (uint32_t esperado = 0; unixtimeAgora() == 0 && esperado < timeoutMs; esperado += 250) delay(250);
  return unixtimeAgora() != 0;
}

inline ResultadoEnvio enviarUmaVez(const ConfigTransmissao& cfg, const std::string& corpo) {
  const String url = cfg.urlBase + CAMINHO_TELEMETRIA;
  HTTPClient http;
  WiFiClientSecure clienteSeguro;
  WiFiClient clientePuro;

  bool iniciou;
  if (url.startsWith("https://")) {
    if (cfg.certificadoRaiz == nullptr) {
      Serial.println("[telemetria] https sem certificado raiz configurado");
      return ResultadoEnvio::ERRO_PERMANENTE;
    }
    clienteSeguro.setCACert(cfg.certificadoRaiz);
    iniciou = http.begin(clienteSeguro, url);
  } else {
    iniciou = http.begin(clientePuro, url);
  }
  if (!iniciou) return ResultadoEnvio::ERRO_TRANSITORIO;

  http.setTimeout(cfg.timeoutMs);
  http.setConnectTimeout(cfg.timeoutMs);
  http.addHeader("Content-Type", "application/json");
  http.addHeader(HEADER_CHAVE_ESTACAO, cfg.chaveEstacao);

  const int codigo = http.POST(String(corpo.c_str()));  // negativo: sem resposta (timeout, conexão)
  const ResultadoEnvio resultado = classificarResposta(codigo);

  if (resultado == ResultadoEnvio::ERRO_PERMANENTE) {
    // Registrar e não reenviar: o mesmo pacote seria recusado de novo.
    Serial.printf("[telemetria] erro permanente HTTP %d: %s\n", codigo, http.getString().c_str());
  } else if (resultado == ResultadoEnvio::ERRO_TRANSITORIO) {
    Serial.printf("[telemetria] falha transitoria (%d)\n", codigo);
  }
  http.end();
  return resultado;
}

// Monta e envia uma leitura. Reenvia o MESMO pacote (mesmo unixtime) só em falha transitória;
// a API descarta duplicados. Se esgotar as tentativas devolve ERRO_TRANSITORIO e a leitura
// continua com quem chamou, para o buffer.
inline ResultadoEnvio enviarTelemetria(const ConfigTransmissao& cfg, int64_t unixtime,
                                       const std::vector<Leitura>& leituras) {
  const std::string corpo = montarPayload(cfg.vid.c_str(), unixtime, cfg.local, leituras);
  if (corpo.empty()) {
    // Sem leitura válida ou vid inválido: reenviar não resolve.
    Serial.println("[telemetria] pacote nao montado (sem leituras validas ou vid invalido)");
    return ResultadoEnvio::ERRO_PERMANENTE;
  }

  const uint8_t tentativas = cfg.tentativasMax > 0 ? cfg.tentativasMax : 1;
  ResultadoEnvio resultado = ResultadoEnvio::ERRO_TRANSITORIO;
  for (uint8_t tentativa = 1; tentativa <= tentativas; tentativa++) {
    resultado = enviarUmaVez(cfg, corpo);
    if (resultado != ResultadoEnvio::ERRO_TRANSITORIO) return resultado;
    if (tentativa < tentativas) delay(cfg.esperaReenvioMs);
  }
  return resultado;
}

}  // namespace transmissao
