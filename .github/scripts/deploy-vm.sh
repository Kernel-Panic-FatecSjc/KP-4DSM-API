#!/usr/bin/env bash
# RASCUNHO, NÃO VALIDADO: depende da VM (Roadmap DevOps, Fase 4).
# Roda NA VM, chamado por deploy-pre-release.yaml, release.yaml e hotfix.yaml
# por SSH. Instala um pacote-<sha>.tar.gz já copiado para a VM:
#
#   /opt/datapanic/releases/<sha>/   cada versão numa pasta
#   /opt/datapanic/current -> releases/<sha>   o que está no ar
#   /opt/datapanic/shared/.env       configuração do ambiente (nunca no pacote)
#
# Passos: extrai → npm ci --omit=dev → prisma migrate deploy → troca o link
# current → reinicia os serviços → /saude. Se a saúde falhar, volta o link para
# a versão anterior e reinicia. ATENÇÃO: isso volta o CÓDIGO, não o banco. Por
# isso migrations seguem expand/contract (política de banco, seção 4): a versão
# anterior precisa funcionar com o schema novo.
#
# Uso: deploy-vm.sh <sha> <caminho do pacote na VM>

set -euo pipefail

SHA=${1:?sha}
PACOTE=${2:?pacote}
BASE=${BASE:-/opt/datapanic}
SERVICOS=${SERVICOS:-"datapanic-api datapanic-ingestao datapanic-tratamento datapanic-front"}
SAUDE=${SAUDE:-"http://localhost:3001/saude http://localhost:3002/saude http://localhost:3003/saude"}

destino="$BASE/releases/$SHA"
# Só se já houver um link: readlink -f de um caminho inexistente devolve o
# próprio caminho, e o rollback criaria um link para si mesmo.
anterior=""
[ -L "$BASE/current" ] && anterior=$(readlink -f "$BASE/current")

echo "== Versões neste ambiente (política de banco 1.2)"
set -a; . "$BASE/shared/.env"; set +a
psql "$DATABASE_URL" -Atc "select 'PostgreSQL ' || current_setting('server_version'), 'PostGIS ' || postgis_lib_version()" || true
node -v

echo "== Instalar $SHA"
mkdir -p "$destino"
tar -xzf "$PACOTE" -C "$destino"
(cd "$destino/kernelpanic-backend" && npm ci --omit=dev --ignore-scripts && npx prisma --version | head -n 3)
(cd "$destino/frontend/frontend" && npm ci --omit=dev --ignore-scripts)
ln -sfn "$BASE/shared/.env" "$destino/kernelpanic-backend/.env"

echo "== Migrations (expand/contract: não há volta automática do banco)"
(cd "$destino/kernelpanic-backend" && npx prisma migrate deploy)

reiniciar() { for s in $SERVICOS; do sudo systemctl restart "$s"; done; }
saudavel() {
  for url in $SAUDE; do
    ok=false
    for _ in $(seq 1 30); do curl -fsS "$url" > /dev/null && { ok=true; break; }; sleep 2; done
    $ok || { echo "::error::$url não respondeu"; return 1; }
  done
}

echo "== Trocar current e reiniciar"
ln -sfn "$destino" "$BASE/current"
reiniciar

if saudavel; then
  echo "Deploy de $SHA ok."
  # Mantém as 5 versões mais recentes para rollback.
  ls -1dt "$BASE"/releases/* | tail -n +6 | xargs -r rm -rf
  exit 0
fi

echo "::error::$SHA não ficou saudável. Voltando o código para ${anterior:-nenhuma versão anterior}."
if [ -n "$anterior" ]; then
  ln -sfn "$anterior" "$BASE/current"
  reiniciar
  saudavel || echo "::error::A versão anterior também não ficou saudável: abra incidente e siga o runbook."
fi
exit 1
