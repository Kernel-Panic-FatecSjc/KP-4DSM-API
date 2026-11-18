#!/usr/bin/env bash
# Prepara um ambiente (pré-release ou produção) no servidor da prefeitura.
# Roda como root, uma vez por ambiente, e de novo sempre que mudar porta ou
# domínio no .env. Não instala a aplicação: quem instala é o pipeline de CD
# (deploy-vm.yaml), por SSH, com o usuário criado aqui.
#
# Pré-requisitos no servidor (manual de instalação, seção 7.1): Node.js na
# versão do .nvmrc, PostgreSQL 16 + PostGIS, Mosquitto com dynamic-security,
# Caddy 2, curl e psql.
#
# Uso:
#   sudo PREFIXO=datapanic BASE=/opt/datapanic bash preparar-servidor.sh
#   (pré-release no mesmo servidor: PREFIXO=datapanic-pre BASE=/opt/datapanic-pre)
#
# 1ª execução: cria usuário e pastas, copia env.servidor.example para
#              $BASE/shared/.env e para, pedindo para preencher.
# 2ª execução: confere o .env, gera as units systemd e o site do Caddy, libera
#              o restart dos serviços para o usuário de deploy e imprime o que
#              vai nos campos do Environment do GitHub.

set -euo pipefail

PREFIXO=${PREFIXO:-datapanic}
BASE=${BASE:-/opt/$PREFIXO}
USUARIO=${USUARIO:-$PREFIXO}
AQUI=$(cd "$(dirname "$0")" && pwd)
ENV="$BASE/shared/.env"

[ "$(id -u)" -eq 0 ] || { echo "Rode como root (sudo)."; exit 1; }
for cmd in node npm psql curl systemctl caddy; do
  command -v "$cmd" > /dev/null || { echo "Falta '$cmd' no servidor (manual de instalação, seção 7.1)."; exit 1; }
done

echo "== Usuário $USUARIO e pastas em $BASE"
id "$USUARIO" > /dev/null 2>&1 || useradd --system --create-home --shell /bin/bash "$USUARIO"
install -d -o "$USUARIO" -g "$USUARIO" "$BASE" "$BASE/releases" "$BASE/shared"
install -d -m 700 -o "$USUARIO" -g "$USUARIO" "/home/$USUARIO/.ssh"
touch "/home/$USUARIO/.ssh/authorized_keys"
chown "$USUARIO:$USUARIO" "/home/$USUARIO/.ssh/authorized_keys"
chmod 600 "/home/$USUARIO/.ssh/authorized_keys"

if [ ! -f "$ENV" ]; then
  install -m 600 -o "$USUARIO" -g "$USUARIO" "$AQUI/env.servidor.example" "$ENV"
  echo
  echo "Criado $ENV. Preencha os campos TROQUE e rode este script de novo."
  exit 0
fi

if grep -q 'TROQUE' "$ENV"; then
  echo "Ainda há campos TROQUE em $ENV:"; grep -n 'TROQUE' "$ENV"; exit 1
fi
chmod 600 "$ENV"; chown "$USUARIO:$USUARIO" "$ENV"

ler() { (set -a; . "$ENV"; eval "printf '%s' \"\${$1:-}\""); }
DOMINIO=$(ler DOMINIO); PORT=$(ler PORT); INGESTAO_PORTA=$(ler INGESTAO_PORTA)
TRATAMENTO_PORTA=$(ler TRATAMENTO_PORTA); FRONT_PORTA=$(ler FRONT_PORTA)
for v in DOMINIO PORT INGESTAO_PORTA TRATAMENTO_PORTA FRONT_PORTA; do
  [ -n "${!v}" ] || { echo "Falta $v em $ENV."; exit 1; }
done

echo "== Conexão com o banco"
psql "$(ler DATABASE_URL | sed 's/?.*//')" -Atc "select 'PostgreSQL ' || current_setting('server_version')" \
  || { echo "O DATABASE_URL de $ENV não conecta. Crie o banco e o usuário (seção 7.2)."; exit 1; }
psql "$(ler DATABASE_URL | sed 's/?.*//')" -Atc "create extension if not exists postgis; select 'PostGIS ' || postgis_lib_version()" \
  || { echo "PostGIS indisponível nesse banco (seção 7.2)."; exit 1; }

echo "== Units systemd"
servicos=""
unit() { # <nome> <pasta> <comando>
  local arq="/etc/systemd/system/$PREFIXO-$1.service"
  sed -e "s#@NOME@#$1#g" -e "s#@PREFIXO@#$PREFIXO#g" -e "s#@USUARIO@#$USUARIO#g" \
      -e "s#@BASE@#$BASE#g" -e "s#@PASTA@#$2#g" -e "s#@EXEC@#$3#g" \
      "$AQUI/servico.modelo" > "$arq"
  servicos="$servicos $PREFIXO-$1"
  echo "  $arq"
}
node_bin=$(command -v node)
unit api kernelpanic-backend "$node_bin dist/main.js"
unit ingestao kernelpanic-backend "$node_bin dist-servicos/servicos/ingestao/main.js"
unit tratamento kernelpanic-backend "$node_bin dist-servicos/servicos/tratamento/main.js"
unit front frontend/frontend "$node_bin node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port \${FRONT_PORTA}"
systemctl daemon-reload
# Sobem no boot; o primeiro start de verdade é o do primeiro deploy (antes
# disso não existe $BASE/current).
for s in $servicos; do systemctl enable "$s" > /dev/null; done

echo "== Permissão de restart para o deploy"
sudoers="/etc/sudoers.d/$PREFIXO-deploy"
{
  echo "# Gerado por preparar-servidor.sh: o deploy (deploy-vm.sh) só reinicia estes serviços."
  for s in $servicos; do echo "$USUARIO ALL=(root) NOPASSWD: $(command -v systemctl) restart $s"; done
} > "$sudoers.tmp"
chmod 440 "$sudoers.tmp"
visudo -cf "$sudoers.tmp" > /dev/null && mv "$sudoers.tmp" "$sudoers"

echo "== Site no Caddy ($DOMINIO)"
site="/etc/caddy/$PREFIXO.caddy"
sed -e "s#@DOMINIO@#$DOMINIO#g" -e "s#@PORT@#$PORT#g" -e "s#@INGESTAO_PORTA@#$INGESTAO_PORTA#g" \
    -e "s#@FRONT_PORTA@#$FRONT_PORTA#g" -e "s#@PREFIXO@#$PREFIXO#g" \
    "$AQUI/Caddyfile.modelo" > "$site"
grep -qF "import /etc/caddy/*.caddy" /etc/caddy/Caddyfile 2>/dev/null \
  || echo "import /etc/caddy/*.caddy" >> /etc/caddy/Caddyfile
install -d -o caddy -g caddy /var/log/caddy 2>/dev/null || install -d /var/log/caddy
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile > /dev/null
systemctl reload caddy

cat <<EOF

Pronto. Falta:
  1. Colar a chave PÚBLICA de deploy em /home/$USUARIO/.ssh/authorized_keys.
  2. No GitHub, Settings > Environments > <pre-release|producao>:
       segredos   SERVIDOR_HOST         (IP ou nome do servidor visto do GitHub)
                  SERVIDOR_USUARIO      $USUARIO
                  SERVIDOR_CHAVE_SSH    (chave PRIVADA de deploy)
                  SERVIDOR_KNOWN_HOSTS  (saída de: ssh-keyscan -p <porta> <host>)
       variáveis  URL_SAUDE             https://$DOMINIO/api/saude
                  SERVIDOR_BASE         $BASE
                  SERVIDOR_SERVICOS     ${servicos# }
                  SERVIDOR_SAUDE_LOCAL  http://localhost:$PORT/saude http://localhost:$INGESTAO_PORTA/saude http://localhost:$TRATAMENTO_PORTA/saude
                  SERVIDOR_PORTA        (só se o SSH não for a 22)
  3. Depois do primeiro deploy, uma vez: criar o primeiro administrador (o seed
     usa ts-node, que é de dev: instala, roda e tira de novo)
       sudo -u $USUARIO bash -c 'cd $BASE/current/kernelpanic-backend && npm ci --ignore-scripts && npm run db:seed && npm prune --omit=dev'
EOF
