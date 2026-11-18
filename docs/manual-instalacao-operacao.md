# Manual de instalação e operação do DATA PANIC

Este manual descreve a instalação reproduzível do DATA PANIC em ambiente local/de
teste e reúne as orientações de operação dos componentes existentes no repositório.
As configurações de produção que ainda não estão implementadas ou definidas estão
identificadas como **[a validar]**.

## 1. Componentes e fluxo

| Componente | Tecnologia/configuração do projeto | Função e dependências |
| --- | --- | --- |
| Interface web | Next.js 16, React 19; diretório `frontend/frontend` | Acessa a API pela URL `NEXT_PUBLIC_API_URL`. |
| API | NestJS 12; diretório `kernelpanic-backend/src`; porta padrão 3001 | CRUD, autenticação, auditoria, dashboards e configuração das estações. Usa PostgreSQL e, quando habilitado, o broker MQTT. |
| Serviço de ingestão | NestJS; `kernelpanic-backend/servicos/ingestao`; porta padrão 3002 | Consome mensagens MQTT e aceita ingestão HTTP; grava leituras brutas no PostgreSQL. |
| Serviço de tratamento | NestJS; `kernelpanic-backend/servicos/tratamento`; porta padrão 3003 | Processa leituras brutas em lotes e grava medidas e leituras com erro no PostgreSQL. |
| Banco de dados | PostgreSQL 16 com PostGIS 3.4, imagem `postgis/postgis:16-3.4` | Persistência comum à API e aos dois serviços. O esquema e as migrations ficam em `kernelpanic-backend/prisma`. |
| Broker de telemetria | Eclipse Mosquitto 2.0.21, MQTT na porta 1883 | Recebe mensagens das estações e as disponibiliza ao serviço de ingestão. Usa o plugin dynamic-security e armazenamento persistente. |

### 1.1 Fluxo de Comunicação

O fluxo de processamento da telemetria ocorre da seguinte maneira:

  1. As estações meteorológicas enviam mensagens por meio do protocolo MQTT.
  2. O broker Mosquitto recebe e disponibiliza as mensagens ao serviço de ingestão.
  3. O serviço de ingestão registra as informações recebidas como leituras brutas no PostgreSQL.
  4. O serviço de tratamento processa as leituras armazenadas.
  5. Os dados processados são registrados como medidas ou leituras com erro.
  6. A API disponibiliza os dados para consulta e gerenciamento pela interface web.

A ingestão também permite o recebimento de dados por HTTP, como alternativa à comunicação MQTT.

A API e os serviços de ingestão e tratamento compartilham o banco de dados configurado por meio da variável DATABASE_URL.

Observação: o docker-compose.yml do projeto inicializa somente o PostgreSQL e o broker MQTT. A API, os serviços de ingestão e tratamento e o frontend são executados separadamente.

## 2. Pré-requisitos, infraestrutura e stack

### Servidores e sistema operacional

- Linux (Ubuntu Server 20.04/22.04 LTS recomendado)
- Windows 10/11 com WSL2 e Docker Desktop

### Recursos de Hardware mínimos

- **Processador:** 2 vCPUs / 1.5 GHz ou superior **[a validar]**
- **Memória RAM:** 2 GB ou superior **[a validar]**
- **Armazenamento:** 10 GB de espaço livre em disco **[a validar]**

### Dependências de software

- **Git:** necessário para clonar o repositório e obter atualizações.
- **Node.js e npm:** necessários para instalar dependências, compilar e executar
  os processos. O arquivo `.nvmrc` seleciona Node.js 24;
- **Docker Engine e Docker Compose:** necessários para executar PostgreSQL e
  Mosquitto conforme o `docker-compose.yml` do projeto. As versões mínimas não
  estão fixadas: **[a validar]**.
- **Rede:** os processos precisam alcançar suas dependências. Portas padrão:
  `3000` (frontend), `3001` (API), `3002` (ingestão HTTP), `3003` (tratamento
  HTTP), `5432` (PostgreSQL) e `1883` (MQTT). 
- **Ferramentas da equipe:** GitHub é usado para hospedar o código; Jira consta
  como ferramenta de acompanhamento do projeto, mas não é dependência necessária
  para executar a plataforma.

### Stack implementada

| Camada | Tecnologia/versão usada |
| --- | --- |
| Linguagem backend | TypeScript 6.0.3 no lockfile do backend |
| Linguagem frontend | TypeScript 5.9.3 no lockfile do frontend |
| API e serviços | NestJS 12.0.1 no lockfile do backend |
| Interface web | Next.js 16.3.4 e React 19.2.8 |
| Banco de dados | PostgreSQL 16 com PostGIS 3.4 (`postgis/postgis:16-3.4`) |
| Broker MQTT | Eclipse Mosquitto 2.0.21 (`eclipse-mosquitto:2.0.21`) |

As versões de PostgreSQL, PostGIS e Mosquitto acima são as tags configuradas no
Compose; versões de patch e política de atualização dessas imagens em produção
são **[a validar]**.

## 3. Instalação local ou em ambiente de teste

Os comandos abaixo usam PowerShell. Instale Git, Node.js 24 e Docker Desktop com
WSL2 antes de começar. Execute na sequência, mantenha os processos em execução
em terminais separados e use a raiz do repositório como diretório inicial.

### 3.1 Clonar o repositório

```powershell
git clone https://github.com/Kernel-Panic-FatecSjc/KP-4DSM-API.git
Set-Location .\KP-4DSM-API
```

### 3.2 Configurar variáveis do backend

```powershell
Set-Location .\kernelpanic-backend
Copy-Item .env.example .env
```

Edite `kernelpanic-backend/.env` e ajuste as URLs e segredos ao ambiente. No
ambiente local, mantenha `DATABASE_URL` compatível com as credenciais e o banco
definidos em `docker-compose.yml`. O arquivo de exemplo contém valores de
desenvolvimento; substitua-os antes de qualquer implantação compartilhada ou de
produção.

Variáveis principais:

| Variável | Uso |
| --- | --- |
| `DATABASE_URL` | Conexão PostgreSQL da aplicação, Prisma e serviços. |
| `DATABASE_POOL_MAX` | Limite de conexões do pool PostgreSQL. |
| `PORT`, `INGESTAO_PORTA`, `TRATAMENTO_PORTA` | Portas HTTP padrão: 3001, 3002 e 3003. |
| `JWT_SECRET`, `JWT_EXPIRES_IN` | Assinatura e duração do JWT. Defina um segredo forte e exclusivo. |
| `COOKIE_SECURE`, `COOKIE_SAMESITE`, `FRONTEND_URL` | Cookie de sessão e origem CORS do frontend. Em HTTPS, habilite `COOKIE_SECURE`; para sites em domínios diferentes, `COOKIE_SAMESITE=none` requer cookie seguro. |
| `SEED_USUARIO_NOME`, `SEED_USUARIO_EMAIL`, `SEED_USUARIO_SENHA` | Identidade do administrador inicial criado pelo seed. Troque a senha de exemplo. |
| `MQTT_URL`, `MQTT_ADMIN_USUARIO`, `MQTT_ADMIN_SENHA` | Conexão e credenciais administrativas do broker usadas pela API para provisionar estações. |
| `MQTT_INGESTAO_USUARIO`, `MQTT_INGESTAO_SENHA`, `MQTT_INGESTAO_CLIENT_ID` | Credenciais e identificador persistente do consumidor de telemetria. |
| `INGESTAO_ROTA_ABERTA` | Permite ingestão HTTP sem chave somente em `development` ou `test`; mantenha `false` nos demais ambientes. |
| `INGESTAO_LOTE_TAMANHO_MAX`, `INGESTAO_LOTE_INTERVALO_MS`, `INGESTAO_LOTE_TENTATIVAS_MAX`, `INGESTAO_ENCERRAMENTO_PRAZO_MS` | Limites de lote, intervalo, tentativas e encerramento da ingestão. |
| `TRATAMENTO_LOTE_TAMANHO`, `TRATAMENTO_INTERVALO_MS` | Tamanho de lote e intervalo de varredura do tratamento. |
| `LIMITE_REQUISICOES_POR_MINUTO`, `LIMITE_LOGIN_POR_MINUTO` | Limites de requisições e tentativas de login. |
| `ALARMES_TEMPO_REAL` | Habilita ou desabilita o listener de alarmes em tempo real no PostgreSQL. |
| `DATABASE_URL_TESTE` | Banco separado para testes funcionais; o nome precisa terminar em `_test`. Se omitida, o backend deriva o nome acrescentando `_test` a `DATABASE_URL`. Os testes funcionais apagam e recriam esse banco. |

Use os mesmos valores de credenciais MQTT no arquivo `.env` e no ambiente em que
o Compose os interpolará. A configuração Mosquitto cria as credenciais
administrativas e de ingestão no primeiro início do volume; as credenciais por
estação são criadas pela API no cadastro ou na regeneração da chave.

### 3.3 Iniciar banco e broker

Ainda em `kernelpanic-backend`:

```powershell
docker compose up -d postgres broker
docker compose ps
```

O Compose mantém os dados em volumes (`postgres_data` e `broker_data`). Não remova
esses volumes ao reiniciar serviços. O banco expõe a porta `5432` e o broker
`1883` no host neste Compose de desenvolvimento. 
### 3.4 Instalar dependências e preparar o banco

Em um terminal na pasta `kernelpanic-backend`:

```powershell
npm ci
npx prisma migrate deploy
npm run db:seed
```

`migrate deploy` aplica as migrations versionadas sem recriar o banco. O seed
insere o usuário inicial `ADMIN_TECSUS` apenas se o e-mail ainda não existir; ele
imprime a credencial configurada no terminal. Guarde-a com segurança e altere-a
de acordo com a política do ambiente.

### 3.5 Compilar os serviços do backend

Ainda em `kernelpanic-backend`:

```powershell
npm run build
npm run build:servicos
```

O primeiro comando compila a API e gera o cliente Prisma pelo script `prebuild`.
O segundo compila os serviços de ingestão e tratamento.

### 3.6 Iniciar os processos do backend

Inicie cada processo em um terminal independente, todos com o diretório de
trabalho `kernelpanic-backend` e o mesmo `.env`.

Desenvolvimento (API com recarga automática):

```powershell
npm run start:dev
```

Ingestão:

```powershell
npm run start:ingestao
```

Tratamento:

```powershell
npm run start:tratamento
```

Para executar a API compilada em vez do modo de desenvolvimento:

```powershell
npm run start:prod
```

O processo de ingestão conecta ao broker quando `MQTT_URL` está definido; sem
essa variável, a recepção via broker não é configurada. A rota HTTP de ingestão
continua disponível conforme as configurações de chave do serviço.

### 3.7 Instalar e iniciar o frontend

Abra outro terminal na raiz do repositório e execute:

```powershell
Set-Location .\frontend\frontend
npm ci
npm run dev
```

Abra `http://localhost:3000`. Por padrão, o frontend usa a API em
`http://localhost:3001`. Para outro endereço, crie `frontend/frontend/.env.local`
com `NEXT_PUBLIC_API_URL` apontando para a URL acessível pelo navegador e ajuste
`FRONTEND_URL` no backend para a origem do site. `NEXT_PUBLIC_API_URL` é embutida
no build do frontend; configure-a antes de `npm run build`.

### 3.8 Verificar a instalação

- Confirme `docker compose ps` e os logs dos contêineres:

  ```powershell
  Set-Location .\kernelpanic-backend
  docker compose logs --tail 100 postgres broker
  ```

- Confirme que API, ingestão e tratamento iniciaram sem erros de conexão com o
  banco. A documentação Swagger da API fica em `http://localhost:3001/docs`.
- Acesse `http://localhost:3000` e autentique-se com o usuário criado pelo seed.
- Se for validar telemetria MQTT, cadastre uma estação pela API para gerar uma
  chave e use o simulador existente (`npm run simulador` em
  `kernelpanic-backend`) com as configurações e o formato descritos em
  [mqtt-topico-payload.md](./mqtt-topico-payload.md).
- Testes funcionais do backend recriam o banco configurado em `DATABASE_URL_TESTE`.
  Nunca aponte essa variável para um banco com dados que devam ser preservados.

## 4. Configuração para implantação

> O caminho padrão para pré-release e produção é o da **seção 7**: servidor
> próprio preparado por `infra/servidor/preparar-servidor.sh` e deploy feito pelo
> pipeline de CD. Esta seção fica como referência para quem montar a
> infraestrutura de outro jeito.

1. Provisionar PostgreSQL 16 com PostGIS 3.4 e Mosquitto 2.0.21 com plugin
   dynamic-security, armazenamento persistente e rede privada entre os serviços.
2. Criar os bancos, usuários, senhas, regras de rede, DNS e TLS conforme a
   arquitetura escolhida **[a validar]**. Não reutilizar as credenciais do Compose
   nem os valores de `.env.example`.
3. Disponibilizar o código ou artefatos compilados em cada host. Usar `npm ci`
   com os lockfiles de `kernelpanic-backend` e `frontend/frontend`; instalar apenas
   dependências de produção no runtime, caso o processo de empacotamento escolhido
   permita **[a validar]**.
4. Configurar as variáveis de ambiente em um gerenciador de segredos do ambiente,
   nunca em arquivos versionados. Usar o mesmo `DATABASE_URL` nos três processos
   do backend; configurar corretamente URLs, credenciais MQTT, `JWT_SECRET`,
   cookies e origem do frontend.
5. Antes de iniciar a nova versão, executar `npx prisma migrate deploy` no
   diretório do backend e então iniciar API, ingestão, tratamento e frontend com
   um gerenciador de processos adequado. Ordem de implantação sem interrupção,
   rollback e migrações incompatíveis: **[a validar]**.
6. Publicar somente os endpoints que precisem ser acessíveis. PostgreSQL deve
   permanecer privado; acesso MQTT e HTTP da ingestão deve ser limitado aos
   dispositivos/redes autorizados conforme a arquitetura de produção **[a validar]**.

Para cookies entre domínios diferentes, a configuração da API exige origem CORS
explícita (`FRONTEND_URL`), credenciais habilitadas e cookie `SameSite=None`
seguro sobre HTTPS. Certificados e terminação TLS não são configurados pelo
projeto e precisam ser providos pela infraestrutura.

## 5. Execução, manutenção e atualização

### Inicialização e parada

- Inicie PostgreSQL e broker com `docker compose up -d postgres broker` na pasta
  `kernelpanic-backend`.
- Inicie API, ingestão e tratamento com os comandos da seção 3.6 e o frontend
  com o comando da seção 3.7. Em produção, use o gerenciador de processos definido
  para o ambiente **[a validar]**.
- Para parar os contêineres sem apagar os dados, execute
  `docker compose stop postgres broker`. Para parar os processos Node, envie
  `SIGTERM` ou use o gerenciador que os iniciou. Os serviços NestJS habilitam
  hooks de encerramento; a ingestão tenta descarregar seu lote pendente durante
  o encerramento.

### Diagnóstico básico

- Ver estado dos contêineres: `docker compose ps`.
- Consultar logs do banco/broker: `docker compose logs --tail 100 postgres broker`.
- Consultar logs de cada processo Node no terminal ou no gerenciador de processos.
- Verificar se `DATABASE_URL` aponta ao mesmo banco e se o PostgreSQL está
  acessível a partir de cada processo.
- Se a ingestão MQTT não receber mensagens, verificar `MQTT_URL`, a conectividade
  com a porta 1883, as credenciais e os logs do broker/ingestão.
- A documentação interativa da API está disponível em `/docs` no endereço da API.

### Atualização da aplicação

Parta da raiz do repositório e execute cada comando no terminal indicado:

1. Fazer backup conforme a política aprovada para o ambiente; validar o backup e
   o procedimento de restauração antes de uma atualização de produção
   **[a validar]**.
2. Obter a versão aprovada do código e instalar dependências de acordo com os
   lockfiles:

   ```powershell
   Set-Location .\kernelpanic-backend
   npm ci
   Set-Location ..\frontend\frontend
   npm ci
   ```

3. Configurar as variáveis da nova versão e aplicar migrations compatíveis:

   ```powershell
   Set-Location .\kernelpanic-backend
   npx prisma migrate deploy
   npm run build
   npm run build:servicos
   Set-Location ..\frontend\frontend
   npm run build
   ```

4. Reiniciar os processos da API, ingestão, tratamento e frontend usando o
   mecanismo do ambiente e conferir logs, acesso à interface e comunicação com a
   API. O procedimento exato de deploy/rollback é **[a validar]**.

Não use `prisma migrate reset` para atualizar um ambiente com dados reais: esse
comando apaga e recria o banco. Ele é usado pela configuração de testes funcionais
do backend no banco de teste.

### Dados e persistência

O Compose local persiste dados nos volumes `postgres_data` e `broker_data`.
`docker compose down` mantém os volumes; `docker compose down -v` os remove e
apaga os dados persistidos. Não execute a segunda forma em ambientes que precisem
preservar dados.

O broker mantém mensagens MQTT em disco para sessões persistentes da ingestão. A
capacidade de armazenamento e as políticas de backup/recuperação do banco e do
broker em produção ainda são **[a validar]**.

## 6. Referências do repositório

- Configuração de ambiente: `kernelpanic-backend/.env.example`.
- Serviços locais de banco e broker: `kernelpanic-backend/docker-compose.yml`.
- Configuração Mosquitto: `broker/mosquitto.conf` e `broker/iniciar.sh`.
- Esquema e migrações: `kernelpanic-backend/prisma/schema.prisma` e
  `kernelpanic-backend/prisma/migrations/`.
- Formato de telemetria: [mqtt-topico-payload.md](./mqtt-topico-payload.md).
- Scripts e dependências: `kernelpanic-backend/package.json` e
  `frontend/frontend/package.json`.

## 7. Implantação no servidor (pré-release e produção)

O deploy é automático (SCRUM-29). O que cabe à prefeitura, uma vez, é preparar o
servidor e preencher as variáveis de cada ambiente. Depois disso, cada versão
chega sozinha à pré-release e vai para a produção quando alguém aprova o PR.

```
PR aprovado → main → suíte noturna verde (02:00) → branch pre-release
  → deploy na pré-release → PR automático pre-release → release
  → aprovação humana + merge → deploy na produção → tag versao/AAAA-MM-DD
```

Pré-release e produção recebem o **mesmo pacote** (`pacote-<sha>.tar.gz`). Só
muda a configuração: o `.env` do servidor e o Environment do GitHub.

### 7.1 Servidor

- Linux com systemd (recomendado: Ubuntu Server 24.04 LTS ou Debian 12).
- Node.js na versão do `.nvmrc`, PostgreSQL 16 + PostGIS 3.4, Mosquitto 2 com
  dynamic-security (`broker/`), Caddy 2, `curl` e `psql`.
- Portas abertas para fora: 443 e 80 (Caddy) e a do MQTT para as estações. SSH
  (22 ou outra) só para o GitHub Actions e para os mantenedores. PostgreSQL e as
  portas internas (3000 a 3003) ficam só em `127.0.0.1`.
- O GitHub Actions precisa alcançar o SSH do servidor. Se o servidor não puder
  ficar exposto, use um runner auto-hospedado na rede da prefeitura **[a validar]**.
- Pré-release e produção podem ficar no mesmo servidor (portas, pastas, banco e
  domínio diferentes) ou em servidores separados. Recomendado: separados, ou ao
  menos bancos separados; a pré-release roda as migrations antes da produção.

### 7.2 Banco e broker

1. Criar o usuário e o banco de cada ambiente (ex.: `datapanic` e
   `datapanic_pre`) e habilitar o PostGIS (`CREATE EXTENSION postgis;`, como
   superusuário, se o usuário da aplicação não puder).
2. Configurar o Mosquitto com dynamic-security (ver `broker/iniciar.sh`), com
   senhas novas para o admin e para a ingestão. Nunca reutilize as senhas `-dev`.

### 7.3 Preparar cada ambiente

Da raiz de uma cópia do repositório no servidor:

```bash
# produção
sudo PREFIXO=datapanic BASE=/opt/datapanic bash infra/servidor/preparar-servidor.sh
# pré-release (no mesmo servidor, se for o caso)
sudo PREFIXO=datapanic-pre BASE=/opt/datapanic-pre bash infra/servidor/preparar-servidor.sh
```

Na primeira execução o script cria o usuário de deploy e as pastas e copia
`infra/servidor/env.servidor.example` para `$BASE/shared/.env`. Preencha todos
os campos `TROQUE` (domínio, banco, `JWT_SECRET`, senhas MQTT, administrador) e
rode de novo. Na segunda execução ele confere o banco, gera as units systemd
(`<prefixo>-api`, `-ingestao`, `-tratamento`, `-front`), o site do Caddy (front
em `/`, API em `/api`, ingestão HTTP em `/ingestao`) e a permissão de restart, e
imprime os valores para o GitHub.

| Arquivo no servidor | Conteúdo |
| --- | --- |
| `$BASE/shared/.env` | configuração do ambiente (só no servidor, `chmod 600`) |
| `$BASE/releases/<sha>/` | as 5 versões mais recentes, para rollback |
| `$BASE/current` | link para a versão no ar |
| `$BASE/deploys.log` | quando, o quê, resultado, quem e o run de cada deploy/rollback |

### 7.4 GitHub (admin do repositório)

1. **Environments** `pre-release` e `producao` (Settings → Environments), com os
   segredos `SERVIDOR_HOST`, `SERVIDOR_USUARIO`, `SERVIDOR_CHAVE_SSH`,
   `SERVIDOR_KNOWN_HOSTS` e as variáveis `URL_SAUDE`, `SERVIDOR_BASE`,
   `SERVIDOR_SERVICOS`, `SERVIDOR_SAUDE_LOCAL` (e `SERVIDOR_PORTA` se o SSH não
   for a 22), com os valores que o script imprimiu. Em `producao`, restrinja as
   branches de deploy a `release` e `hotfix/*`.
2. **Environment** `aprovacao-hotfix`, sem segredos, com **revisores
   obrigatórios**: é o gate humano do hotfix.
3. **Branches** `pre-release` e `release`: criar uma vez a partir do commit que
   está (ou estará) em produção. Rulesets:
   - `pre-release`: bloquear push forçado e exclusão; só o GitHub Actions
     atualiza (bypass para o app GitHub Actions; ninguém mais faz push).
   - `release`: exigir PR com **1 aprovação**, exigir o status `pre-release`,
     permitir só **merge commit**, bloquear push forçado e exclusão.
4. Settings → Actions → General: marcar **Allow GitHub Actions to create and
   approve pull requests** (o PR pre-release → release é aberto pelo workflow).
5. Por último, a variável de repositório `CD_HABILITADO=true`. Antes dela, todo
   deploy falha dizendo o que falta.

### 7.5 Operação

| Situação | O que fazer |
| --- | --- |
| Publicar em produção | Revisar o PR `pre-release → release`, testar a pré-release, aprovar e fazer merge com **Create a merge commit** |
| Rodar a promoção de novo (ex.: servidor corrigido) | Actions → Deploy na pré-release → Run workflow |
| Repetir o deploy de produção | Actions → Release → Run workflow (branch `release`) |
| Produção com comportamento errado | Actions → Rollback (ambiente, versão opcional, motivo). Abre uma issue de incidente |
| Urgência que não espera a noite | Fluxo de hotfix (`hotfix.yaml`), com aprovação no Environment `aprovacao-hotfix` |
| Primeiro administrador | Comando impresso no fim do `preparar-servidor.sh` |

O rollback volta o **código**, não o banco. Por isso as migrations seguem
expand/contract: a versão anterior precisa funcionar com o schema novo.
