#!/usr/bin/env bash
# Deploy direto com healthcheck e rollback automático (docs/CD.md, estágios 2 e 5).
# Roda no servidor, no diretório do ambiente:  scripts/deploy.sh sha-<commit>
#
# Ordem pensada para que qualquer falha antes da troca deixe a versão antiga no
# ar intacta:
#   1. baixar as imagens novas        (falhou: nada mudou)
#   2. aplicar migrations             (falhou: nada mudou; expand/contract
#                                      garante que o código antigo continua
#                                      compatível com o schema novo)
#   3. trocar IMAGE_TAG e recriar     (janela de indisponibilidade de 10-30s)
#   4. healthcheck com retry          (falhou: rollback para versao_atual)
set -euo pipefail
# shellcheck source=scripts/comum.sh
source "$(dirname "${BASH_SOURCE[0]}")/comum.sh"

NOVA="${1:?uso: deploy.sh sha-<commit>}"
validar_tag "$NOVA"

AMBIENTE=$(ler_env AMBIENTE)
ANTERIOR=$(cat "$ARQUIVO_VERSAO" 2>/dev/null || true)
INICIADO_EM=$(agora_utc)

escrever_resultado() {
  {
    echo "status=$1"
    echo "ambiente=$AMBIENTE"
    echo "versao_nova=$NOVA"
    echo "versao_anterior=$ANTERIOR"
    echo "iniciado_em=$INICIADO_EM"
    echo "concluido_em=$(agora_utc)"
    echo "downtime_segundos=${DOWNTIME:-}"
    echo "migrations=${MIGRATIONS:-}"
  } > "$ARQUIVO_RESULTADO_DEPLOY"
}

# O resultado do deploy anterior não pode sobreviver: se este falhar no meio,
# o workflow leria um "sucesso" velho. Qualquer erro não tratado vira "falha".
rm -f "$ARQUIVO_RESULTADO_DEPLOY"
trap 'escrever_resultado falha' ERR

echo "Ambiente: $AMBIENTE | no ar: ${ANTERIOR:-nenhuma} | nova: $NOVA"

echo "::group::Baixar imagens $NOVA"
# IMAGE_TAG do shell tem precedência sobre o .env: a tag nova só é gravada no
# .env depois que as migrations passarem.
IMAGE_TAG="$NOVA" compose pull api web
echo "::endgroup::"

echo "::group::Migrations"
compose up -d --wait postgres
IMAGE_TAG="$NOVA" compose run --rm --no-deps api npx prisma migrate deploy
# Migrations aplicadas por ESTE deploy, para o registro de auditoria.
MIGRATIONS=$(sql -c "SELECT string_agg(migration_name, ',' ORDER BY finished_at)
                     FROM _prisma_migrations
                     WHERE finished_at >= '$INICIADO_EM'::timestamptz")
echo "Aplicadas agora: ${MIGRATIONS:-nenhuma}"
echo "::endgroup::"

if [ "$AMBIENTE" = "homologacao" ]; then
  echo "::group::Seed sintético (homologação)"
  # O seed de bootstrap imprime a senha do admin; ela não vai para o log do CI.
  IMAGE_TAG="$NOVA" compose run --rm --no-deps api npm run --silent db:seed \
    | sed -E 's#^(Usuário inicial disponível: [^ ]+ / ).*#\1[omitida]#'
  IMAGE_TAG="$NOVA" compose run --rm --no-deps api npm run --silent db:seed:homologacao
  echo "::endgroup::"
fi

echo "::group::Recriar containers"
definir_tag "$NOVA"
INICIO_TROCA=$(date +%s)
compose up -d --remove-orphans
echo "::endgroup::"

if aguardar_saude; then
  # Aproximação da janela de indisponibilidade: da recriação até o primeiro
  # healthcheck saudável.
  DOWNTIME=$(( $(date +%s) - INICIO_TROCA ))
  echo "$NOVA" > "$ARQUIVO_VERSAO"
  escrever_resultado sucesso
  echo "Deploy OK: $NOVA (indisponibilidade aproximada: ${DOWNTIME}s)"
  exit 0
fi

echo "::error::Healthcheck de $NOVA falhou após $TENTATIVAS_SAUDE tentativas."
compose logs --tail 80 api || true

if [ -z "$ANTERIOR" ]; then
  # Primeiro deploy do ambiente: não existe versão saudável para onde voltar.
  escrever_resultado falha
  echo "::error::Não há versão anterior registrada em $ARQUIVO_VERSAO; nada a reverter."
  exit 1
fi

echo "Revertendo para $ANTERIOR."
# Reverte só o código. O schema fica como está: com expand/contract, a versão
# anterior continua funcionando com as migrations novas.
if "$APP_DIR/scripts/rollback.sh" "$ANTERIOR"; then
  escrever_resultado revertido
else
  escrever_resultado falha_no_rollback
  echo "::error::O rollback automático para $ANTERIOR também falhou. Intervenção manual necessária."
fi
exit 1
