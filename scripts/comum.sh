# shellcheck shell=bash
# Variáveis definidas aqui são usadas pelos scripts que fazem source deste arquivo.
# shellcheck disable=SC2034
# Funções compartilhadas pelos scripts de CD. Todos rodam NO SERVIDOR, a partir
# do diretório do ambiente (APP_DIR), onde ficam docker-compose.prod.yml,
# Caddyfile, .env, versao_atual e esta pasta scripts/ (docs/CD.md).

APP_DIR="${APP_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)}"
ARQUIVO_ENV="$APP_DIR/.env"
# Tag da versão que está no ar e saudável. Só é escrita depois do healthcheck
# passar, então é sempre um alvo seguro de rollback.
ARQUIVO_VERSAO="$APP_DIR/versao_atual"
# Resultado do último deploy/smoke, lido pelo workflow para montar o registro
# de auditoria (formato chave=valor, compatível com $GITHUB_OUTPUT).
ARQUIVO_RESULTADO_DEPLOY="$APP_DIR/ultimo-deploy.env"
ARQUIVO_RESULTADO_SMOKE="$APP_DIR/ultimo-smoke.env"

TENTATIVAS_SAUDE="${TENTATIVAS_SAUDE:-15}"
INTERVALO_SAUDE="${INTERVALO_SAUDE:-3}"

[ -f "$ARQUIVO_ENV" ] || { echo "::error::$ARQUIVO_ENV não existe. Veja docs/CD.md, 'Preparar o servidor'."; exit 1; }

compose() {
  docker compose --project-directory "$APP_DIR" -f "$APP_DIR/docker-compose.prod.yml" --env-file "$ARQUIVO_ENV" "$@"
}

# Lê uma chave do .env sem dar `source` nele: o arquivo tem segredos e não deve
# ir para o ambiente do shell inteiro (nem aparecer num `set -x` acidental).
ler_env() {
  local valor
  valor=$(grep -E "^$1=" "$ARQUIVO_ENV" | tail -n1 | cut -d= -f2- || true)
  valor="${valor%\"}"
  valor="${valor#\"}"
  printf '%s' "${valor:-${2:-}}"
}

validar_tag() {
  if ! [[ "$1" =~ ^sha-[0-9a-f]{7,40}$ ]]; then
    echo "::error::Tag inválida: '$1' (esperado sha-<commit>)"
    exit 1
  fi
}

# Troca só a linha IMAGE_TAG do .env, preservando o resto da configuração.
definir_tag() {
  validar_tag "$1"
  if grep -qE '^IMAGE_TAG=' "$ARQUIVO_ENV"; then
    sed -i "s/^IMAGE_TAG=.*/IMAGE_TAG=$1/" "$ARQUIVO_ENV"
  else
    echo "IMAGE_TAG=$1" >> "$ARQUIVO_ENV"
  fi
}

# URL pela qual os smoke tests entram, passando pelo Caddy como um usuário real.
url_base() {
  ler_env URL_SMOKE "http://localhost:$(ler_env HTTP_PORT 80)"
}

# Healthcheck direto no container da API (sem depender do Caddy nem de DNS):
# /health só responde 200 se o banco também responder.
saude_api() {
  compose exec -T api node -e "
    fetch('http://localhost:3001/health')
      .then((r) => process.exit(r.ok ? 0 : 1))
      .catch(() => process.exit(1));
  " >/dev/null 2>&1
}

aguardar_saude() {
  local i
  for i in $(seq 1 "$TENTATIVAS_SAUDE"); do
    if saude_api; then
      echo "Healthcheck OK na tentativa $i."
      return 0
    fi
    echo "Healthcheck $i/$TENTATIVAS_SAUDE falhou, nova tentativa em ${INTERVALO_SAUDE}s."
    sleep "$INTERVALO_SAUDE"
  done
  return 1
}

# psql no container do banco; o SQL vem pela entrada padrão. As credenciais
# ficam no servidor e nunca passam pelo runner do GitHub.
sql() {
  compose exec -T postgres psql \
    -U "$(ler_env POSTGRES_USER)" -d "$(ler_env POSTGRES_DB)" \
    -qtAX -v ON_ERROR_STOP=1 "$@"
}

agora_utc() {
  date -u +%Y-%m-%dT%H:%M:%SZ
}
