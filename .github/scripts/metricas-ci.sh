#!/usr/bin/env bash
# Métricas do CI e do fluxo de PR, para a retrospectiva (sugestão: ainda não
# é exigido nem roda sozinho). Lê a API do GitHub com o gh já autenticado.
#
# Uso: bash .github/scripts/metricas-ci.sh [quantidade de runs, padrão 50]
#
#   - duração média e máxima do workflow CI (meta do PR: ~10 min)
#   - taxa de falha do CI na main e nos PRs
#   - idade dos PRs abertos (PR velho = integração atrasada, Fowler prática 4)

set -euo pipefail
N=${1:-50}
REPO=${GH_REPO:-$(gh repo view --json nameWithOwner -q .nameWithOwner)}

echo "## CI: últimos $N runs concluídos ($REPO)"
gh api "repos/$REPO/actions/workflows/ci.yaml/runs?status=completed&per_page=$N" --jq '
  [.workflow_runs[] | select(.conclusion != "cancelled" and .conclusion != "skipped")
    | {main: (.head_branch == "main"), falhou: (.conclusion == "failure"),
       dur: ((.updated_at | fromdate) - (.run_started_at | fromdate))}] as $r
  | def taxa(x): if (x | length) == 0 then "sem runs" else "\((x | map(select(.falhou)) | length) * 100 / (x | length) | floor)% de \(x | length)" end;
  "duração média: \(($r | map(.dur) | add / length) / 60 | floor) min (máx. \(($r | map(.dur) | max) / 60 | floor) min)",
  "falhas na main: \(taxa($r | map(select(.main))))",
  "falhas em PRs:  \(taxa($r | map(select(.main | not))))"'

echo
echo "## PRs abertos por idade"
gh pr list --repo "$REPO" --state open --json number,title,createdAt --jq '
  sort_by(.createdAt)[]
  | "\(((now - (.createdAt | fromdate)) / 86400) | floor) dias  #\(.number) \(.title)"'
