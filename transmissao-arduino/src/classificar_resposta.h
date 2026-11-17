// Classifica o resultado de POST /ingestao/telemetria.
#pragma once

namespace transmissao {

enum class ResultadoEnvio {
  SUCESSO,           // 202: a API guardou a leitura
  ERRO_PERMANENTE,   // 400, 401, 404: registrar e NÃO reenviar
  ERRO_TRANSITORIO,  // 5xx, timeout ou falha de conexão: a leitura vai para o buffer
};

// `codigoHttp` é o que o HTTPClient devolve: o status HTTP, ou um valor
// negativo quando não houve resposta (timeout, conexão recusada, sem Wi-Fi).
// Qualquer código que a API não documenta para esta rota também é transitório:
// o pior caso é um reenvio, que a API descarta (índice único parâmetro + unixtime),
// e a leitura nunca se perde.
inline ResultadoEnvio classificarResposta(int codigoHttp) {
  if (codigoHttp == 202) return ResultadoEnvio::SUCESSO;
  if (codigoHttp == 400 || codigoHttp == 401 || codigoHttp == 404) return ResultadoEnvio::ERRO_PERMANENTE;
  return ResultadoEnvio::ERRO_TRANSITORIO;
}

}  // namespace transmissao
