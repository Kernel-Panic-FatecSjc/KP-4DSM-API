// Monta o corpo JSON de POST /ingestao/telemetria (IngerirTelemetriaDto).
// Só C++ padrão (sem Arduino), para rodar também no computador nos testes.
#pragma once

#include <cctype>
#include <cmath>
#include <cstdint>
#include <cstdio>
#include <string>
#include <vector>

namespace transmissao {

// Mesmos limites de servicos/ingestao/validacao (mapa-leituras e unixtime).
constexpr size_t MAXIMO_SENSORES = 50;
constexpr size_t MAXIMO_TAMANHO_NOME = 64;
constexpr size_t MAXIMO_TAMANHO_VID = 64;
constexpr int64_t UNIXTIME_MINIMO = 1000000000;

struct Leitura {
  std::string sensor;  // nome do tipo de parâmetro cadastrado na estação
  double valor;
};

struct Localizacao {
  bool valida = false;
  double latitude = 0;
  double longitude = 0;
};

// ^[a-zA-Z][a-zA-Z0-9_]{0,63}$
inline bool nomeSensorValido(const std::string& nome) {
  if (nome.empty() || nome.size() > MAXIMO_TAMANHO_NOME) return false;
  if (!std::isalpha(static_cast<unsigned char>(nome[0]))) return false;
  for (char c : nome) {
    if (!std::isalnum(static_cast<unsigned char>(c)) && c != '_') return false;
  }
  return true;
}

// Sem escape: um vid com aspas, barra ou caractere de controle não é um vid real.
inline bool vidValido(const std::string& vid) {
  if (vid.empty() || vid.size() > MAXIMO_TAMANHO_VID) return false;
  for (char c : vid) {
    const unsigned char u = static_cast<unsigned char>(c);
    if (u < 0x20 || c == '"' || c == '\\') return false;
  }
  return true;
}

inline std::string numero(double valor, const char* formato) {
  char buffer[40];
  std::snprintf(buffer, sizeof(buffer), formato, valor);
  return buffer;
}

// Devolve o JSON, ou "" quando não há o que enviar (vid inválido ou nenhuma leitura válida).
// Leituras com valor NaN/infinito (falha do sensor) ou nome fora do padrão ficam de fora,
// porque a API recusaria o pacote inteiro por causa delas.
// unixtime só entra se o relógio do dispositivo estiver acertado.
inline std::string montarPayload(const std::string& vid, int64_t unixtime, const Localizacao& local,
                                 const std::vector<Leitura>& leituras) {
  if (!vidValido(vid)) return "";

  std::string leiturasJson;
  size_t aceitas = 0;
  for (const Leitura& l : leituras) {
    if (aceitas >= MAXIMO_SENSORES) break;
    if (!nomeSensorValido(l.sensor) || !std::isfinite(l.valor)) continue;
    if (aceitas > 0) leiturasJson += ',';
    leiturasJson += '"' + l.sensor + "\":" + numero(l.valor, "%.4f");
    ++aceitas;
  }
  if (aceitas == 0) return "";

  std::string json = "{\"vid\":\"" + vid + '"';
  if (unixtime >= UNIXTIME_MINIMO) json += ",\"unixtime\":" + std::to_string(unixtime);
  if (local.valida && std::isfinite(local.latitude) && std::isfinite(local.longitude)) {
    json += ",\"latitude\":" + numero(local.latitude, "%.6f");
    json += ",\"longitude\":" + numero(local.longitude, "%.6f");
  }
  json += ",\"leituras\":{" + leiturasJson + "}}";
  return json;
}

}  // namespace transmissao
