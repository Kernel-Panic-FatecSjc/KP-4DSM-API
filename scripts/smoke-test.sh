#!/usr/bin/env bash
# Smoke tests do CD (docs/CD.md, estágio 3). Qualquer falha aborta o pipeline.
# Roda no servidor:  scripts/smoke-test.sh homologacao | producao
#
#   homologacao  saúde, ingestão ponta a ponta e disparo de alerta
#   producao     só verificações NÃO destrutivas: um teste de alerta em
#                produção geraria um alarme de emergência real, visível para a
#                Defesa Civil. Nada aqui grava no banco de produção.
#
# Para adicionar um teste: escreva uma função teste_<nome> que retorna 0/1 e
# chame `executar <nome> teste_<nome>` no bloco do ambiente, lá embaixo.
set -euo pipefail
# shellcheck source=scripts/comum.sh
source "$(dirname "${BASH_SOURCE[0]}")/comum.sh"

MODO="${1:?uso: smoke-test.sh homologacao|producao}"
AMBIENTE=$(ler_env AMBIENTE)
URL=$(url_base)

# Dados do seed sintético (kernelpanic-backend/prisma/seed-homologacao.ts).
VID_SMOKE="SMOKE-001"
ESTACAO_SMOKE_ID="00000000-0000-4000-8000-00000000e001"
PARAMETRO_SMOKE_ID="00000000-0000-4000-8000-00000000e003"
# Alerta sintético: MAIOR_QUE 100, severidade EMERGENCIA.
VALOR_ACIMA_DO_LIMIAR=150
SEVERIDADE_ESPERADA="EMERGENCIA"

if [ "$MODO" != "$AMBIENTE" ]; then
  # Impede rodar os testes destrutivos de homologação apontando para produção.
  echo "::error::Modo '$MODO' não corresponde ao AMBIENTE '$AMBIENTE' deste servidor."
  exit 1
fi

: > "$ARQUIVO_RESULTADO_SMOKE"

executar() {
  local nome="$1"
  shift
  echo "::group::Smoke: $nome"
  if "$@"; then
    echo "$nome=ok" >> "$ARQUIVO_RESULTADO_SMOKE"
    echo "::endgroup::"
    echo "ok     $nome"
  else
    echo "$nome=falhou" >> "$ARQUIVO_RESULTADO_SMOKE"
    echo "::endgroup::"
    echo "::error::Smoke test '$nome' falhou em $AMBIENTE."
    exit 1
  fi
}

# Imprime o código HTTP da requisição. O corpo vai para um arquivo, e não para
# uma variável, porque `codigo=$(http ...)` roda num subshell.
ARQUIVO_CORPO=$(mktemp)
trap 'rm -f "$ARQUIVO_CORPO"' EXIT
http() {
  curl -s --max-time 10 -o "$ARQUIVO_CORPO" -w '%{http_code}' "$@" || true
}
corpo() {
  cat "$ARQUIVO_CORPO"
}

# ---- Testes comuns aos dois ambientes (não destrutivos) ---------------------

teste_health() {
  # Pelo Caddy, como o datalogger e o navegador chegam.
  local codigo
  codigo=$(http "$URL/api/health")
  echo "GET /api/health -> $codigo $(corpo)"
  [ "$codigo" = "200" ] && [[ "$(corpo)" == *'"banco":"ok"'* ]]
}

teste_autenticacao() {
  # Rota protegida sem cookie precisa recusar, e a ingestão com chave errada
  # também. O 401 da ingestão vem do guard, antes de qualquer gravação; se a
  # rota respondesse outra coisa, INGESTAO_CHAVE_API estaria vazia e a
  # ingestão aberta (ver guarda-chave-ingestao.guard.ts).
  local perfil ingestao
  perfil=$(http "$URL/api/autenticacao/perfil")
  ingestao=$(http -X POST "$URL/api/ingestao/telemetria" \
    -H 'Content-Type: application/json' -H 'x-chave-estacao: chave-invalida-smoke-test' \
    -d '{}')
  echo "GET /api/autenticacao/perfil sem cookie -> $perfil"
  echo "POST /api/ingestao/telemetria com chave inválida -> $ingestao"
  [ "$perfil" = "401" ] && [ "$ingestao" = "401" ]
}

teste_documentacao() {
  local codigo
  codigo=$(http "$URL/api/openapi.json")
  echo "GET /api/openapi.json -> $codigo"
  [ "$codigo" = "200" ]
}

teste_frontend() {
  local codigo
  codigo=$(http "$URL/login")
  echo "GET /login -> $codigo"
  [ "$codigo" = "200" ]
}

# ---- Testes de homologação (gravam dados sintéticos) ------------------------

teste_ingestao() {
  local chave codigo id persistida
  chave=$(ler_env INGESTAO_CHAVE_API)
  codigo=$(http -X POST "$URL/api/ingestao/telemetria" \
    -H 'Content-Type: application/json' -H "x-chave-estacao: $chave" \
    -d "{\"vid\":\"$VID_SMOKE\",\"leituras\":{\"pluviometro\":12.5}}")
  echo "POST /api/ingestao/telemetria -> $codigo $(corpo)"
  [ "$codigo" = "202" ] || return 1

  id=$(corpo | grep -oE '"leituraBrutaId":"[0-9a-f-]{36}"' | cut -d'"' -f4)
  [ -n "$id" ] || { echo "Resposta sem leituraBrutaId."; return 1; }

  persistida=$(sql -v id="$id" <<'SQL'
SELECT count(*) FROM leituras_brutas WHERE id = :'id' AND "vidEstacao" = 'SMOKE-001';
SQL
)
  echo "Leitura bruta $id persistida: $persistida"
  [ "$persistida" = "1" ]
}

teste_alerta() {
  # Hoje a ingestão grava só em leituras_brutas; nada ainda normaliza para
  # "medidas", que é onde a trigger trg_avaliar_alerta_medida dispara. Até essa
  # normalização existir (US04), o teste insere a medida direto no banco e
  # valida o motor de alertas (US06) de ponta a ponta a partir daí.
  # Quando existir, troque o INSERT por um POST com leitura acima do limiar.
  #
  # Tudo roda numa transação desfeita no final: a trigger dispara e o alarme é
  # conferido, mas nada fica gravado, nem em homologação.
  local severidade
  severidade=$(sql -v parametro="$PARAMETRO_SMOKE_ID" -v estacao="$ESTACAO_SMOKE_ID" \
    -v valor="$VALOR_ACIMA_DO_LIMIAR" <<'SQL'
BEGIN;
INSERT INTO medidas (id, unixtime, valor, "parametroId", "estacaoId")
VALUES (gen_random_uuid(), extract(epoch FROM now())::bigint, :valor, :'parametro', :'estacao')
RETURNING id AS medida_id \gset
SELECT a.severidade
FROM alarmes al
JOIN alertas a ON a.id = al."alertaId"
WHERE al."medidaId" = :'medida_id';
ROLLBACK;
SQL
)
  echo "Alarme gerado com severidade: ${severidade:-nenhum} (esperado $SEVERIDADE_ESPERADA)"
  [ "$severidade" = "$SEVERIDADE_ESPERADA" ]
}

echo "Smoke tests em $AMBIENTE via $URL"

executar health teste_health

case "$MODO" in
  homologacao)
    executar ingestao teste_ingestao
    executar alerta teste_alerta
    executar autenticacao teste_autenticacao
    ;;
  producao)
    executar autenticacao teste_autenticacao
    executar documentacao teste_documentacao
    executar frontend teste_frontend
    ;;
  *)
    echo "::error::Modo desconhecido: $MODO"
    exit 1
    ;;
esac

echo "Todos os smoke tests passaram em $AMBIENTE."
