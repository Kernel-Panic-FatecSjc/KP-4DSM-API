#!/usr/bin/env bash
# Sobe a pilha real e roda o ponta a ponta da suíte noturna:
#   Postgres/PostGIS + Mosquitto (mesmas imagens do docker-compose.yml)
#   -> API, ingestão e tratamento (build de produção, node)
#   -> front (next start) -> Playwright sem interceptar a API
# e, com a pilha no ar, a carga leve e o simulador MQTT.
#
# Uso (da raiz do repositório, com npm ci e os builds já feitos):
#   bash .github/scripts/pilha-e2e.sh            # tudo
#   ETAPAS="saude simulador" bash .github/scripts/pilha-e2e.sh
#
# O compose roda num projeto próprio (COMPOSE_PROJECT_NAME, padrão kp-noturna):
# os volumes do ambiente de dev não são tocados, e o "down -v" do fim apaga só
# os deste projeto. Só dados de seed e sintéticos, nunca dados reais (LGPD).
# Limites da carga em variáveis: os oficiais aguardam decisão (P18/P19); o
# padrão de p95 é a meta do plano de QA (docs/teste-de-carga-ingestao.md).

set -euo pipefail

RAIZ=$(cd "$(dirname "$0")/../.." && pwd)
API_DIR="$RAIZ/kernelpanic-backend"
WEB_DIR="$RAIZ/frontend/frontend"
LOGS=${LOGS:-$RAIZ/pilha-logs}
ETAPAS=${ETAPAS:-"saude simulador e2e carga restauracao"}

export COMPOSE_PROJECT_NAME=${COMPOSE_PROJECT_NAME:-kp-noturna}
PORTA_API=${PORTA_API:-3001}
PORTA_FRONT=${PORTA_FRONT:-3000}
BANCO=${BANCO:-kernelpanic_noturna_carga} # "carga" no nome: exigência dos scripts de carga

export DATABASE_URL="postgresql://kernelpanic:kernelpanic@localhost:5432/$BANCO?schema=public"
export PORT=$PORTA_API INGESTAO_PORTA=3002 TRATAMENTO_PORTA=3003
export JWT_SECRET=segredo-so-da-suite-noturna JWT_EXPIRES_IN=1h
export COOKIE_SECURE=false COOKIE_SAMESITE=lax FRONTEND_URL="http://localhost:$PORTA_FRONT"
export LIMITE_REQUISICOES_POR_MINUTO=100000 LIMITE_LOGIN_POR_MINUTO=100000
export MQTT_URL=mqtt://localhost:1883 MQTT_ADMIN_USUARIO=admin MQTT_ADMIN_SENHA=admin-dev
export MQTT_INGESTAO_USUARIO=ingestao MQTT_INGESTAO_SENHA=ingestao-dev MQTT_INGESTAO_CLIENT_ID=ingestao
export SEED_USUARIO_NOME=Administrador SEED_USUARIO_EMAIL=admin@kernelpanic.dev SEED_USUARIO_SENHA=admin12345

mkdir -p "$LOGS"
pids=()
compose() { docker compose -f "$API_DIR/docker-compose.yml" "$@"; }
psql_() { compose exec -T postgres psql -U kernelpanic -v ON_ERROR_STOP=1 "$@"; }
falhar() { echo "::error::$1"; exit 1; }

encerrar() {
  for pid in "${pids[@]}"; do kill "$pid" 2>/dev/null || true; done
  compose logs --no-color > "$LOGS/compose.log" 2>&1 || true
  [ "${MANTER_PILHA:-false}" = true ] || compose down -v > /dev/null 2>&1 || true
}
trap encerrar EXIT

esperar() { # nome url
  for _ in $(seq 1 60); do
    curl -fsS "$2" > /dev/null 2>&1 && { echo "  ok   $1 ($2)"; return 0; }
    sleep 1
  done
  echo "--- últimas linhas de $LOGS/$1.log"; tail -n 40 "$LOGS/$1.log" || true
  falhar "$1 não respondeu em $2 em 60 s. Veja o log acima e o artefato pilha-logs."
}

subir() { # nome diretório comando...
  local nome=$1 dir=$2; shift 2
  (cd "$dir" && exec "$@") > "$LOGS/$nome.log" 2>&1 &
  pids+=($!)
}

echo "== Banco e broker ($COMPOSE_PROJECT_NAME)"
compose up -d postgres broker
# Por TCP: na 1ª subida o Postgres roda um servidor temporário só no socket
# (initdb) e reinicia; o socket responder não quer dizer que ele está pronto.
for _ in $(seq 1 60); do compose exec -T postgres pg_isready -q -h 127.0.0.1 -U kernelpanic && break; sleep 1; done
psql_ -c "DROP DATABASE IF EXISTS $BANCO" -c "CREATE DATABASE $BANCO" > /dev/null
compose exec -T postgres psql -U kernelpanic -At -c 'select version()' | sed 's/^/  /'
compose exec -T postgres psql -U kernelpanic -d "$BANCO" -At -c 'create extension if not exists postgis; select '"'"'PostGIS '"'"' || postgis_lib_version()' | tail -n 1 | sed 's/^/  /'

echo "== Migrations do zero e seed"
(cd "$API_DIR" && npx prisma migrate deploy > "$LOGS/migrate.log" 2>&1) || { tail -n 30 "$LOGS/migrate.log"; falhar "prisma migrate deploy falhou num banco vazio."; }
(cd "$API_DIR" && npm run db:seed > "$LOGS/seed.log" 2>&1) || { tail -n 30 "$LOGS/seed.log"; falhar "Seed falhou."; }

echo "== Serviços"
subir api "$API_DIR" node dist/main
subir ingestao "$API_DIR" node dist-servicos/servicos/ingestao/main.js
subir tratamento "$API_DIR" node dist-servicos/servicos/tratamento/main.js
subir front "$WEB_DIR" npx next start --port "$PORTA_FRONT"
esperar api "http://localhost:$PORTA_API/saude"
esperar ingestao "http://localhost:$INGESTAO_PORTA/saude"
esperar tratamento "http://localhost:$TRATAMENTO_PORTA/saude"
esperar front "http://localhost:$PORTA_FRONT/login"

for etapa in $ETAPAS; do
  case "$etapa" in
    saude)
      echo "== /saude"
      curl -fsS "http://localhost:$PORTA_API/saude"; echo
      ;;
    simulador)
      # Cadeia de dados de verdade: ESP32 simulado -> broker -> ingestão ->
      # leituras_brutas -> tratamento -> medidas.
      echo "== Simulador MQTT"
      (cd "$API_DIR" && NUM_ESTACOES=${SIM_ESTACOES:-5} INTERVALO_S=${SIM_INTERVALO_S:-2} DURACAO_S=${SIM_DURACAO_S:-20} \
        npm run simulador > "$LOGS/simulador.log" 2>&1) || { tail -n 30 "$LOGS/simulador.log"; falhar "Simulador MQTT falhou."; }
      sleep 3
      medidas=$(psql_ -d "$BANCO" -At -c "select count(*) from medidas m join estacoes e on e.id = m.\"estacaoId\" where e.vid like 'SIMULADOR-%'")
      echo "  medidas geradas: $medidas"
      [ "${medidas:-0}" -gt 0 ] || falhar "O simulador publicou, mas nenhuma medida chegou ao banco: veja ingestao.log e tratamento.log no artefato pilha-logs."
      ;;
    e2e)
      echo "== Playwright contra a pilha real"
      (cd "$WEB_DIR" && E2E_URL="http://localhost:$PORTA_FRONT" npm run test:e2e) || falhar "Ponta a ponta falhou: relatório no artefato relatorio-e2e."
      ;;
    carga)
      echo "== Carga leve (rota HTTP da ingestão)"
      (cd "$API_DIR" && URL_API="http://localhost:$INGESTAO_PORTA" NUM_ESTACOES=${CARGA_ESTACOES:-200} \
        TAXAS=${CARGA_TAXAS:-50,100} DURACAO_POR_TAXA=${CARGA_DURACAO_S:-10} LIMITE_P95_MS=${CARGA_LIMITE_P95_MS:-2000} \
        npm run teste:carga:http 2>&1 | tee "$LOGS/carga.log") || falhar "Carga leve: nenhum degrau sustentou p95 <= ${CARGA_LIMITE_P95_MS:-2000} ms sem erro nem perda. Compare com a linha de base em docs/teste-de-carga-ingestao.md."
      ;;
    restauracao)
      # Política de banco, 6.2: backup só vale se a restauração for testada.
      # Dump do banco semeado (+ dados sintéticos das etapas anteriores),
      # restauração num banco efêmero e comparação. O tempo medido é um RTO de
      # referência para o tamanho do seed, não o de produção.
      echo "== Restauração testada (pg_dump -> pg_restore)"
      restaurado="${BANCO}_restaurado"
      inicio=$(date +%s)
      backup="$LOGS/backup.dump" # via stdin/stdout: sem caminho dentro do contêiner
      compose exec -T postgres pg_dump -U kernelpanic -Fc -d "$BANCO" > "$backup"
      psql_ -c "DROP DATABASE IF EXISTS $restaurado" -c "CREATE DATABASE $restaurado" > /dev/null
      compose exec -T postgres pg_restore -U kernelpanic --exit-on-error -d "$restaurado" < "$backup"         || falhar "pg_restore falhou: o backup não restaura num banco vazio."
      rm -f "$backup"
      segundos=$(( $(date +%s) - inicio ))
      retrato() { # o que precisa ser igual nos dois bancos
        psql_ -d "$1" -At <<'SQL'
select 'extensao ' || extname from pg_extension where extname = 'postgis';
select 'trigger ' || tgname from pg_trigger where not tgisinternal order by 1;
select 'constraints ' || count(*) from pg_constraint c join pg_namespace n on n.oid = c.connamespace where n.nspname = 'public';
select 'linhas ' || table_name || ' ' || (xpath('/row/c/text()', query_to_xml(format('select count(*) as c from public.%I', table_name), false, true, '')))[1]::text
  from information_schema.tables where table_schema = 'public' and table_type = 'BASE TABLE' order by 1;
SQL
      }
      retrato "$BANCO" > "$LOGS/retrato-original.txt"
      retrato "$restaurado" > "$LOGS/retrato-restaurado.txt"
      grep -q '^extensao postgis$' "$LOGS/retrato-restaurado.txt" || falhar "Restaurado sem a extensão PostGIS."
      grep -q '^trigger trg_avaliar_alertas_lote$' "$LOGS/retrato-restaurado.txt" || falhar "Restaurado sem a trigger trg_avaliar_alertas_lote."
      diff "$LOGS/retrato-original.txt" "$LOGS/retrato-restaurado.txt"         || falhar "O banco restaurado difere do original (linhas acima: < original, > restaurado)."
      tabelas=$(grep -c '^linhas ' "$LOGS/retrato-restaurado.txt")
      echo "  ok   PostGIS, triggers, constraints e contagem de $tabelas tabelas iguais; restauração em ${segundos}s"
      [ -n "${GITHUB_STEP_SUMMARY:-}" ] && echo "- Restauração testada: ${segundos}s (dump + restore do banco semeado, $tabelas tabelas iguais)" >> "$GITHUB_STEP_SUMMARY"
      ;;
    *) falhar "Etapa desconhecida: $etapa (use saude, simulador, e2e, carga, restauracao)." ;;
  esac
done

echo "Pilha real: todas as etapas passaram ($ETAPAS)."
