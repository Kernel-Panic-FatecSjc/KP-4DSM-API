#!/usr/bin/env bash
# Recoloca no ar uma tag já publicada no registry, sem rebuild e sem migrations
# (docs/CD.md, "Rollback"). Usado pelo deploy.sh quando o healthcheck falha e
# pelo workflow manual rollback.yml.
# Roda no servidor:  scripts/rollback.sh sha-<commit>
#
# Schema não volta: migrations são sempre para frente, e o expand/contract é o
# que garante que uma versão anterior do código funciona com o schema atual.
set -euo pipefail
# shellcheck source=scripts/comum.sh
source "$(dirname "${BASH_SOURCE[0]}")/comum.sh"

ALVO="${1:?uso: rollback.sh sha-<commit>}"
validar_tag "$ALVO"
TAG_EM_USO="$ALVO"

echo "Rollback para $ALVO (no ar: $(cat "$ARQUIVO_VERSAO" 2>/dev/null || echo nenhuma))"

# A imagem provavelmente ainda está em cache local; o pull só garante.
compose pull api web
definir_tag "$ALVO"
compose up -d --remove-orphans

if aguardar_saude; then
  echo "$ALVO" > "$ARQUIVO_VERSAO"
  echo "Rollback OK: $ALVO no ar."
  exit 0
fi

echo "::error::A versão $ALVO também não passou no healthcheck."
compose logs --tail 80 api || true
exit 1
