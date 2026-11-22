#!/usr/bin/env bash
# Gera o pacote de um commit: o que a pré-release e a produção instalam.
# "Build once, deploy many": o mesmo arquivo vai para todos os ambientes, só a
# configuração (Environment do GitHub / .env da VM) muda. Nada de segredo aqui.
#
# O instalador (infra/servidor/deploy.ps1) vai junto: a versão do script de
# instalação acompanha a versão do sistema.
#
# Uso (da raiz, com os builds já feitos):
#   bash .github/scripts/empacotar.sh <sha> [pasta de saída]
# Saída: pacote-<sha>.tar.gz e pacote-<sha>.tar.gz.sha256
#
# URL da API: o CI constrói o front com NEXT_PUBLIC_API_URL=/api (relativa).
# O proxy do servidor (infra/servidor/Caddyfile) atende /api na mesma origem do
# site, então o pacote não carrega domínio nenhum e é idêntico entre pré-release
# e produção. Quem definir a variável do repositório NEXT_PUBLIC_API_URL com uma
# URL absoluta perde essa propriedade.

set -euo pipefail

SHA=${1:?informe o SHA do commit}
SAIDA=${2:-.}
RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
API=kernelpanic-backend
WEB=frontend/frontend
NOME="pacote-$SHA.tar.gz"

for obrigatorio in "$API/dist" "$API/dist-servicos" "$WEB/.next/BUILD_ID"; do
  [ -e "$RAIZ/$obrigatorio" ] || { echo "::error::Falta $obrigatorio: rode os builds antes (npm run build, build:servicos e o build do front)."; exit 1; }
done

mkdir -p "$SAIDA"
SAIDA=$(cd "$SAIDA" && pwd)

cat > "$RAIZ/VERSAO" <<EOF
commit=$SHA
gerado_em=$(date -u +%Y-%m-%dT%H:%M:%SZ)
node=$(node -v)
EOF

# Dependências não vão no pacote: a VM roda npm ci com o lockfile, que fixa as
# mesmas versões. Cache do Next.js e mapas de fonte do front ficam de fora.
(cd "$RAIZ" && tar -czf "$SAIDA/$NOME" \
  --exclude="$WEB/.next/cache" \
  VERSAO .nvmrc infra/servidor \
  "$API/dist" "$API/dist-servicos" "$API/prisma" "$API/prisma7.config.ts" \
  "$API/package.json" "$API/package-lock.json" \
  "$WEB/.next" "$WEB/public" "$WEB/package.json" "$WEB/package-lock.json" "$WEB/next.config.ts")
rm -f "$RAIZ/VERSAO"

(cd "$SAIDA" && sha256sum "$NOME" > "$NOME.sha256")
echo "Pacote: $SAIDA/$NOME ($(du -h "$SAIDA/$NOME" | cut -f1))"
cat "$SAIDA/$NOME.sha256"
