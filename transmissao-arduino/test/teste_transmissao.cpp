// Roda no computador: g++ -std=c++17 -Wall -Wextra -I../src teste_transmissao.cpp -o teste && ./teste
#include <cassert>
#include <cmath>
#include <iostream>

#include "classificar_resposta.h"
#include "payload_telemetria.h"

using namespace transmissao;

int main() {
  // Payload completo, no formato do IngerirTelemetriaDto.
  assert(montarPayload("A4:CF:12:9B:77:01", 1792869809, {true, -23.1896, -45.8841},
                       {{"temperatura", 24.6}, {"umidade", 61.2}}) ==
         "{\"vid\":\"A4:CF:12:9B:77:01\",\"unixtime\":1792869809,\"latitude\":-23.189600,\"longitude\":-45.884100,"
         "\"leituras\":{\"temperatura\":24.6000,\"umidade\":61.2000}}");

  // unixtime e posição são opcionais.
  assert(montarPayload("vid1", 0, {}, {{"umidade", 50}}) == "{\"vid\":\"vid1\",\"leituras\":{\"umidade\":50.0000}}");

  // NaN (falha do DHT22) e nome inválido ficam de fora; o resto segue.
  assert(montarPayload("vid1", 1792869809, {}, {{"temperatura", NAN}, {"1ruim", 3}, {"umidade", 40}}) ==
         "{\"vid\":\"vid1\",\"unixtime\":1792869809,\"leituras\":{\"umidade\":40.0000}}");

  // Sem leitura válida ou com vid inválido, não há pacote.
  assert(montarPayload("vid1", 1792869809, {}, {{"temperatura", NAN}}).empty());
  assert(montarPayload("vid1", 1792869809, {}, {}).empty());
  assert(montarPayload("", 1792869809, {}, {{"umidade", 1}}).empty());
  assert(montarPayload("a\"b", 1792869809, {}, {{"umidade", 1}}).empty());

  // Nomes de sensor: mesmo padrão da API.
  assert(nomeSensorValido("chuvaMm_2"));
  assert(!nomeSensorValido("_x") && !nomeSensorValido("a-b") && !nomeSensorValido(""));
  assert(nomeSensorValido(std::string(64, 'a')) && !nomeSensorValido(std::string(65, 'a')));

  // Respostas da API.
  assert(classificarResposta(202) == ResultadoEnvio::SUCESSO);
  for (int c : {400, 401, 404}) assert(classificarResposta(c) == ResultadoEnvio::ERRO_PERMANENTE);
  for (int c : {500, 502, 503, 504, -1, -11, 0}) assert(classificarResposta(c) == ResultadoEnvio::ERRO_TRANSITORIO);

  std::cout << "ok\n";
  return 0;
}
