#!/usr/bin/env bash
# Decide quais jobs do CI rodam a partir dos arquivos alterados.
#
# Uso: git diff --name-only <base> HEAD | detectar-alteracoes.sh >> "$GITHUB_OUTPUT"
#
# Lê um caminho por linha na entrada, escreve no stderr por que cada arquivo
# liga (ou não) cada job, e no stdout as saídas chave=valor do job detector.
#
# Cada aplicação é separada (cada uma vai para a sua VPS):
#   backend          lint, typecheck e build da API e dos serviços (servicos/)
#   backend_testes   testes unitários e funcionais da API
#   banco            migrations, schema e seed
#   frontend         lint, typecheck e build do Next.js
#   frontend_testes  testes unitários (Vitest) e funcionais (Playwright) do Next.js
#
# Regras, na ordem em que são avaliadas:
#   1. Pastas de código contam com qualquer extensão. Fixture .json, .md ou
#      .yml dentro de src/, test/, prisma/, app/ etc. é lido por teste ou
#      build, então liga os jobs como código.
#   2. Configuração conhecida liga só o que ela afeta.
#   3. Só depois vem o que sabidamente não afeta nada: .md, .env.example e
#      afins na raiz da aplicação, e tudo fora das duas aplicações.
#   4. Arquivo desconhecido dentro de uma aplicação liga todos os jobs dela.
#      Na dúvida, roda: um job a mais custa minutos, um teste que não rodou
#      vira falso verde.
# Ao criar uma pasta ou configuração nova numa aplicação, classifique-a aqui.

set -euo pipefail

declare -A roda=(
  [backend]=false
  [backend_testes]=false
  [banco]=false
  [frontend]=false
  [frontend_testes]=false
)

ligar() {
  local job
  for job in "$@"; do roda[$job]=true; done
}

API=kernelpanic-backend
WEB=frontend/frontend

while IFS= read -r arquivo; do
  [ -z "$arquivo" ] && continue
  jobs=()

  case "$arquivo" in
    # As próprias regras do CI e a versão do Node: revalida tudo.
    .github/workflows/ci.yaml | .github/scripts/detectar-alteracoes.sh | .nvmrc | .node-version)
      jobs=(backend backend_testes banco frontend frontend_testes) ;;

    # ---------------- Backend (API NestJS) ----------------
    # Schema, migrations, seed e versão do Prisma mudam o banco gerado.
    $API/prisma/* | $API/prisma7.config.ts | $API/package.json | $API/package-lock.json)
      jobs=(backend backend_testes banco) ;;
    # Código (API e serviços de ingestão/tratamento), testes e o que o Jest/ts-jest lê.
    $API/src/* | $API/servicos/* | $API/test/* | $API/tsconfig.json | $API/jest.config.ts)
      jobs=(backend backend_testes) ;;
    # Entra no lint/typecheck/build, mas não muda o resultado dos testes.
    $API/teste-carga/* | $API/tsconfig.build.json | $API/tsconfig.servicos.json | $API/nest-cli.json | $API/oxlint.json)
      jobs=(backend) ;;
    # Não é lido por build nem por teste no CI (o CI sobe o próprio Postgres).
    $API/*.md | $API/.env.example | $API/.gitignore | $API/.prettierrc | $API/docker-compose.yml)
      jobs=() ;;
    $API/*)
      echo "  ?  $arquivo: arquivo novo no backend, sem regra; roda tudo do backend" >&2
      jobs=(backend backend_testes banco) ;;

    # ---------------- Frontend (Next.js) ----------------
    # Os testes funcionais rodam sobre o build de produção, então o que muda o
    # build (public/, next.config.ts, postcss) também liga os testes.
    $WEB/app/* | $WEB/components/* | $WEB/lib/* | $WEB/test/* | $WEB/public/* | \
      $WEB/package.json | $WEB/package-lock.json | $WEB/tsconfig.json | \
      $WEB/next.config.ts | $WEB/postcss.config.mjs | $WEB/vitest.config.mts | $WEB/playwright.config.ts)
      jobs=(frontend frontend_testes) ;;
    # Só o lint usa.
    $WEB/eslint.config.mjs)
      jobs=(frontend) ;;
    $WEB/*.md | $WEB/.gitignore)
      jobs=() ;;
    $WEB/*)
      echo "  ?  $arquivo: arquivo novo no frontend, sem regra; roda tudo do frontend" >&2
      jobs=(frontend frontend_testes) ;;

    # Fora das aplicações: docs/, README, ferramentas de commit da raiz,
    # workflows de processo (estratégia de branch, validação em staging).
    *)
      jobs=() ;;
  esac

  if [ "${#jobs[@]}" -eq 0 ]; then
    echo "  -  $arquivo" >&2
  else
    echo "  +  $arquivo → ${jobs[*]}" >&2
    ligar "${jobs[@]}"
  fi
done

for job in backend backend_testes banco frontend frontend_testes; do
  echo "$job=${roda[$job]}"
done
