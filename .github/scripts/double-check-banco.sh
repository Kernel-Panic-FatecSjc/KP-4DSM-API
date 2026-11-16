#!/usr/bin/env bash
# Double check de banco (política de banco, 7.2): PR que altera migrations
# precisa do link do registro de aprovação no Confluence no corpo do PR.
# O registro é onde ficam as assinaturas: 2 devs para mudança crítica de banco,
# inclusive em hotfix (regra única: hotfix sem banco = 1 dev; com banco = 2).
#
# Uso: git diff --name-only <base> HEAD | CORPO_PR="..." double-check-banco.sh
# Sai 0 se o PR não toca migrations ou se o link está no corpo; 1 se falta.

set -euo pipefail

PADRAO_LINK=${PADRAO_LINK:-'https://[A-Za-z0-9.-]+\.atlassian\.net/wiki/[^[:space:])>]+'}

migrations=$(grep -E '^kernelpanic-backend/prisma/migrations/' || true)
if [ -z "$migrations" ]; then
  echo "O PR não altera prisma/migrations: double check de banco não se aplica."
  exit 0
fi

echo "Migrations no PR:"
printf '  %s\n' $migrations

link=$(printf '%s' "${CORPO_PR:-}" | grep -oE "$PADRAO_LINK" | head -n 1 || true)
if [ -n "$link" ]; then
  echo "Registro de aprovação: $link"
  echo "Confira no registro as 2 assinaturas (double check) antes de aprovar o PR."
  exit 0
fi

echo "::error::Este PR altera migrations e o corpo não tem o link do registro de aprovação no Confluence."
cat <<'AJUDA'

Próximo passo (política de banco, 7.2 e 9):
  1. No Confluence, registre a mudança: o script exato (migration.sql), o risco
     e quem assinou. Mudança de banco precisa da assinatura de 2 devs, também
     em hotfix.
  2. Edite a descrição do PR e cole o link no bloco "Banco de dados" do
     template (ex.: https://<time>.atlassian.net/wiki/spaces/.../pages/...).
  3. Não precisa de push: editar a descrição roda este check de novo.
AJUDA
exit 1
