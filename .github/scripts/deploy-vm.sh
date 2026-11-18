#!/usr/bin/env bash
# Roda NO SERVIDOR, chamado por deploy-vm.yaml por SSH. Instala um
# pacote-<sha>.tar.gz já copiado para o servidor, ou volta para uma versão já
# instalada (--rollback).
#
#   $BASE/releases/<sha>/   cada versão numa pasta (as 5 mais recentes ficam)
#   $BASE/current -> releases/<sha>   o que está no ar
#   $BASE/shared/.env       configuração do ambiente (nunca no pacote)
#   $BASE/deploys.log       uma linha por deploy/rollback: quando, quem, versão, resultado
#
# Deploy: extrai → npm ci --omit=dev → prisma migrate deploy → troca o link
# current → reinicia os serviços → /saude. Se a saúde falhar, volta o link para
# a versão anterior e reinicia. ATENÇÃO: isso volta o CÓDIGO, não o banco. Por
# isso migrations seguem expand/contract (política de banco, seção 4): a versão
# anterior precisa funcionar com o schema novo.
#
# Uso:
#   deploy-vm.sh <sha> <caminho do pacote no servidor>
#   deploy-vm.sh --rollback [sha]     (sem sha: a versão instalada antes da atual)
#
# Configuração (variáveis de ambiente, com padrão; o deploy-vm.yaml repassa as
# do Environment do GitHub): BASE, SERVICOS, SAUDE, DEPLOY_POR, DEPLOY_RUN.
# Preparação do servidor: infra/servidor/preparar-servidor.sh.

set -euo pipefail

BASE=${BASE:-/opt/datapanic}
SERVICOS=${SERVICOS:-"datapanic-api datapanic-ingestao datapanic-tratamento datapanic-front"}
SAUDE=${SAUDE:-"http://localhost:3001/saude http://localhost:3002/saude http://localhost:3003/saude"}
DEPLOY_POR=${DEPLOY_POR:-$(whoami)}
DEPLOY_RUN=${DEPLOY_RUN:-manual}

[ -f "$BASE/shared/.env" ] || { echo "::error::Falta $BASE/shared/.env. Rode infra/servidor/preparar-servidor.sh e preencha o .env (manual de instalação, seção 7)."; exit 1; }

# Só se já houver um link: readlink -f de um caminho inexistente devolve o
# próprio caminho, e o rollback criaria um link para si mesmo.
anterior=""
[ -L "$BASE/current" ] && anterior=$(readlink -f "$BASE/current")

registrar() { # <ação> <sha> <resultado>
  printf '%s\t%s\t%s\t%s\t%s\t%s\n' "$(date -u +%FT%TZ)" "$1" "$2" "$3" "$DEPLOY_POR" "$DEPLOY_RUN" >> "$BASE/deploys.log"
}
reiniciar() { for s in $SERVICOS; do sudo systemctl restart "$s"; done; }
saudavel() {
  for url in $SAUDE; do
    ok=false
    for _ in $(seq 1 30); do curl -fsS "$url" > /dev/null && { ok=true; break; }; sleep 2; done
    $ok || { echo "::error::$url não respondeu"; return 1; }
  done
}
ativar() { # <pasta da versão>
  ln -sfn "$1" "$BASE/current"
  reiniciar
}

if [ "${1:-}" = "--rollback" ]; then
  alvo_sha=${2:-}
  if [ -z "$alvo_sha" ]; then
    # A mais recente instalada que não é a atual.
    alvo=$(ls -1dt "$BASE"/releases/* 2>/dev/null | grep -vxF "${anterior:-/nada}" | head -n 1 || true)
  else
    alvo="$BASE/releases/$alvo_sha"
  fi
  [ -n "$alvo" ] && [ -d "$alvo" ] || { echo "::error::Versão ${alvo_sha:-anterior} não está instalada. Instaladas:"; ls -1t "$BASE/releases"; exit 1; }
  echo "== Rollback: ${anterior##*/} → ${alvo##*/} (só o código; o banco fica como está)"
  ativar "$alvo"
  if saudavel; then registrar rollback "${alvo##*/}" ok; echo "Rollback ok."; exit 0; fi
  registrar rollback "${alvo##*/}" falha
  echo "::error::A versão ${alvo##*/} também não ficou saudável: abra incidente e siga o runbook."
  exit 1
fi

SHA=${1:?sha}
PACOTE=${2:?pacote}
destino="$BASE/releases/$SHA"

echo "== Versões neste ambiente (política de banco 1.2)"
set -a; . "$BASE/shared/.env"; set +a
psql "$DATABASE_URL" -Atc "select 'PostgreSQL ' || current_setting('server_version'), 'PostGIS ' || postgis_lib_version()" || true
node -v

echo "== Instalar $SHA"
rm -rf "$destino"
mkdir -p "$destino"
tar -xzf "$PACOTE" -C "$destino"
rm -f "$PACOTE"
# O CLI do Prisma (e o dotenv do prisma7.config.ts) é devDependency: instala
# tudo pelo lockfile, roda as migrations e só depois tira o que é de dev. Assim
# o migrate usa a versão travada, e não a que o npx baixaria.
(cd "$destino/kernelpanic-backend" && npm ci --ignore-scripts && npx --no-install prisma --version | head -n 3)
(cd "$destino/frontend/frontend" && npm ci --omit=dev --ignore-scripts)
ln -sfn "$BASE/shared/.env" "$destino/kernelpanic-backend/.env"

echo "== Migrations (expand/contract: não há volta automática do banco)"
(cd "$destino/kernelpanic-backend" && npx --no-install prisma migrate deploy && npm prune --omit=dev)

echo "== Trocar current e reiniciar"
ativar "$destino"

if saudavel; then
  echo "Deploy de $SHA ok."
  registrar deploy "$SHA" ok
  # Mantém as 5 versões mais recentes para rollback (nunca apaga a que está no ar).
  ls -1dt "$BASE"/releases/* | tail -n +6 | grep -vxF "$destino" | xargs -r rm -rf
  exit 0
fi

echo "::error::$SHA não ficou saudável. Voltando o código para ${anterior:-nenhuma versão anterior}."
registrar deploy "$SHA" falha
if [ -n "$anterior" ]; then
  ativar "$anterior"
  if saudavel; then
    registrar rollback-automatico "${anterior##*/}" ok
  else
    registrar rollback-automatico "${anterior##*/}" falha
    echo "::error::A versão anterior também não ficou saudável: abra incidente e siga o runbook."
  fi
fi
exit 1
