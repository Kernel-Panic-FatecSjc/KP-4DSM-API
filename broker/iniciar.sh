#!/bin/sh
# Sobe o Mosquitto e, na primeira vez (volume vazio), cria o admin do
# dynamic-security (usado pelo backend para cadastrar estações) e o usuário da
# ingestão, que assina estacoes/+/telemetria. As estações são criadas depois,
# pelo backend, a cada cadastro ou troca de chave.
set -eu

ARQUIVO=/mosquitto/data/dynamic-security.json
: "${MQTT_ADMIN_USUARIO:?defina MQTT_ADMIN_USUARIO}"
: "${MQTT_ADMIN_SENHA:?defina MQTT_ADMIN_SENHA}"
: "${MQTT_INGESTAO_SENHA:?defina MQTT_INGESTAO_SENHA}"
MQTT_INGESTAO_USUARIO="${MQTT_INGESTAO_USUARIO:-ingestao}"

primeira_vez=false
if [ ! -f "$ARQUIVO" ]; then
  mosquitto_ctrl dynsec init "$ARQUIVO" "$MQTT_ADMIN_USUARIO" "$MQTT_ADMIN_SENHA" > /dev/null
  primeira_vez=true
fi
chown -R mosquitto:mosquitto /mosquitto/data
chmod 600 "$ARQUIVO"

mosquitto -c /mosquitto/config/mosquitto.conf &
pid=$!
# O sinal do docker stop chega a este script (PID 1), não ao mosquitto: repassa
# e, lá embaixo, espera ele gravar a fila em disco antes de sair. Sem isso o
# contêiner terminava junto com o script e o que chegou depois do último
# autosave (até 5 s de mensagens para a ingestão parada) se perdia.
trap 'kill -TERM "$pid" 2>/dev/null' TERM INT

if [ "$primeira_vez" = true ]; then
  ctrl() { mosquitto_ctrl -h localhost -u "$MQTT_ADMIN_USUARIO" -P "$MQTT_ADMIN_SENHA" dynsec "$@"; }
  # Espera o broker aceitar conexões.
  tentativas=0
  until ctrl getDefaultACLAccess > /dev/null 2>&1; do
    tentativas=$((tentativas + 1))
    [ "$tentativas" -gt 50 ] && { echo "broker não subiu" >&2; exit 1; }
    sleep 0.2
  done
  ctrl createRole ingestao
  ctrl addRoleACL ingestao subscribePattern 'estacoes/+/telemetria' allow
  ctrl addRoleACL ingestao publishClientReceive 'estacoes/+/telemetria' allow
  ctrl createClient "$MQTT_INGESTAO_USUARIO" -p "$MQTT_INGESTAO_SENHA"
  ctrl addClientRole "$MQTT_INGESTAO_USUARIO" ingestao
  echo "dynamic-security inicializado: admin \"$MQTT_ADMIN_USUARIO\" e ingestão \"$MQTT_INGESTAO_USUARIO\""
fi

# O primeiro wait volta quando chega o sinal; o segundo espera o mosquitto sair.
wait "$pid" || true
wait "$pid" || true
