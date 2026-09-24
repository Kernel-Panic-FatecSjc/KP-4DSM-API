#!/usr/bin/env bash
# Grava o registro de deploy na trilha de auditoria da aplicação (US07,
# docs/CD.md, estágio 6b). Roda no servidor; o JSON do registro chega pela
# entrada padrão, montado pelo workflow:
#
#   ssh servidor "$APP_DIR/scripts/registrar-deploy.sh deploy.producao dep_..." < registro.json
#
# Usa a própria tabela logs_auditoria, que já é imutável no banco (trigger
# logs_auditoria_somente_insert), com a convenção "recurso.verbo" de acao.
# Assim deploys e rollbacks são consultáveis junto com as ações dos usuários.
# usuarioId fica nulo: quem aprovou é uma conta do GitHub, e o registro guarda
# só o login dela (LGPD: nada de nome, e-mail ou CPF).
set -euo pipefail
# shellcheck source=scripts/comum.sh
source "$(dirname "${BASH_SOURCE[0]}")/comum.sh"

ACAO="${1:?uso: registrar-deploy.sh <acao> <deploy_id> < registro.json}"
DEPLOY_ID="${2:?uso: registrar-deploy.sh <acao> <deploy_id> < registro.json}"
[[ "$ACAO" =~ ^deploy\.[a-z_]+$ ]] || { echo "::error::Ação inválida: $ACAO"; exit 1; }

REGISTRO=$(cat)
[ -n "$REGISTRO" ] || { echo "::error::Registro de deploy vazio."; exit 1; }

# Variáveis do psql (:'nome') fazem o escape; o JSON nunca é concatenado no SQL.
sql -v acao="$ACAO" -v deploy_id="$DEPLOY_ID" -v detalhes="$REGISTRO" <<'SQL'
INSERT INTO logs_auditoria (id, acao, entidade, "entidadeId", detalhes, "criadoEm")
VALUES (gen_random_uuid(), :'acao', 'deploy', :'deploy_id', :'detalhes'::jsonb, now());
SQL

echo "Registro $DEPLOY_ID ($ACAO) gravado em logs_auditoria."
