<#
.SYNOPSIS
  Prepara um ambiente do DATA PANIC (pré-release ou produção) num Windows
  Server 2025.

.DESCRIPTION
  Roda como Administrador, uma vez por ambiente, e de novo sempre que mudar
  porta ou domínio no .env. Não instala a aplicação: quem instala é o deploy
  (infra\servidor\deploy.ps1), pelo runner do GitHub ou à mão.

  Pré-requisitos (manual de instalação, seção 7.1): Node.js na versão do
  .nvmrc, PostgreSQL 16 + PostGIS, Mosquitto com dynamic-security e Caddy 2
  (caddy.exe em $CaddyDir).

  1ª execução: cria as pastas e copia env.servidor.example para
               $Base\shared\.env, e para pedindo para preencher.
  2ª execução: confere o .env, instala os 4 serviços do Windows (WinSW), dá ao
               runner permissão de reiniciá-los, configura o Caddy e o
               firewall, e imprime o que vai no GitHub.

.EXAMPLE
  .\preparar-servidor.ps1 -Ambiente pre-release
.EXAMPLE
  .\preparar-servidor.ps1 -Ambiente producao -Prefixo datapanic -Base C:\datapanic
#>
[CmdletBinding()]
param(
  [Parameter(Mandatory)][ValidateSet('pre-release', 'producao')][string]$Ambiente,
  [string]$Prefixo = 'datapanic',
  [string]$Base = 'C:\datapanic',
  # Conta do serviço do runner do GitHub (padrão do instalador do runner).
  [string]$RunnerConta = 'NT AUTHORITY\NETWORK SERVICE',
  [string]$CaddyDir = 'C:\caddy'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
$Aqui = $PSScriptRoot
$ArquivoEnv = Join-Path $Base 'shared\.env'

# WinSW: transforma um executável comum (node, caddy) em serviço do Windows.
$WinSWUrl = 'https://github.com/winsw/winsw/releases/download/v2.12.0/WinSW-x64.exe'
$WinSWSha256 = '05b82d46ad331cc16bdc00de5c6332c1ef818df8ceefcd49c726553209b3a0da'

function Erro([string]$msg) { Write-Host $msg -ForegroundColor Red; exit 1 }
function Passo([string]$msg) { Write-Host "== $msg" -ForegroundColor Cyan }

$admin = ([Security.Principal.WindowsPrincipal][Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $admin) { Erro 'Rode como Administrador.' }
foreach ($cmd in 'node', 'npm.cmd', 'tar') {
  if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { Erro "Falta '$cmd' no servidor (manual de instalação, seção 7.1)." }
}
$caddyExe = Join-Path $CaddyDir 'caddy.exe'
if (-not (Test-Path $caddyExe)) { Erro "Falta $caddyExe (baixe o Caddy 2 para Windows em caddyserver.com e coloque nessa pasta)." }

Passo "Pastas em $Base"
foreach ($p in 'releases', 'shared', 'bin', 'logs', 'servicos') {
  New-Item -ItemType Directory -Path (Join-Path $Base $p) -Force | Out-Null
}

if (-not (Test-Path $ArquivoEnv)) {
  Copy-Item (Join-Path $Aqui 'env.servidor.example') $ArquivoEnv
  Write-Host ''
  Write-Host "Criado $ArquivoEnv. Preencha os campos TROQUE e rode este script de novo." -ForegroundColor Yellow
  exit 0
}
# Só linhas de configuração: o comentário do topo do arquivo também cita TROQUE.
$pendentes = Select-String -Path $ArquivoEnv -Pattern '^\s*[A-Za-z_][A-Za-z0-9_]*\s*=.*TROQUE'
if ($pendentes) {
  Write-Host "Ainda há campos TROQUE em ${ArquivoEnv}:"; $pendentes | ForEach-Object { Write-Host "  linha $($_.LineNumber): $($_.Line)" }
  exit 1
}

# Lê o .env (KEY=valor, com ou sem aspas; # é comentário).
$cfg = @{}
foreach ($linha in Get-Content $ArquivoEnv) {
  if ($linha -match '^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$') {
    $cfg[$Matches[1]] = $Matches[2].Trim().Trim('"').Trim("'")
  }
}
foreach ($v in 'DOMINIO', 'PORT', 'INGESTAO_PORTA', 'TRATAMENTO_PORTA', 'FRONT_PORTA', 'DATABASE_URL') {
  if (-not $cfg[$v]) { Erro "Falta $v em $ArquivoEnv." }
}

Passo 'Permissões das pastas'
# Serviços (LocalService): leem a aplicação e escrevem os logs. Runner: instala
# versões. O .env original: só administradores e o runner (que copia para a
# pasta da versão, onde os serviços leem).
icacls $Base /grant "*S-1-5-19:(OI)(CI)RX" /grant "${RunnerConta}:(OI)(CI)M" /T /Q | Out-Null
icacls (Join-Path $Base 'logs') /grant "*S-1-5-19:(OI)(CI)M" /Q | Out-Null
icacls $ArquivoEnv /inheritance:r /grant "*S-1-5-32-544:F" /grant "*S-1-5-18:F" /grant "${RunnerConta}:R" /Q | Out-Null

Passo 'WinSW'
$winsw = Join-Path $Base 'servicos\WinSW.exe'
if (-not (Test-Path $winsw) -or (Get-FileHash $winsw -Algorithm SHA256).Hash.ToLower() -ne $WinSWSha256) {
  Invoke-WebRequest -Uri $WinSWUrl -OutFile $winsw -UseBasicParsing
  $obtido = (Get-FileHash $winsw -Algorithm SHA256).Hash.ToLower()
  if ($obtido -ne $WinSWSha256) { Remove-Item $winsw; Erro "SHA-256 do WinSW não confere ($obtido). Download adulterado ou versão errada." }
}

function Instalar-Servico([string]$id, [string]$nome, [string]$exec, [string]$argumentos, [string]$dir, [string]$conta) {
  $pasta = Join-Path $Base 'servicos'
  $exe = Join-Path $pasta "$id.exe"
  $xml = Join-Path $pasta "$id.xml"
  Copy-Item $winsw $exe -Force
  $modelo = Get-Content (Join-Path $Aqui 'servico.xml.modelo') -Raw -Encoding UTF8
  $modelo.Replace('@ID@', $id).Replace('@NOME@', $nome).Replace('@PREFIXO@', $Prefixo).Replace('@BASE@', $Base).
    Replace('@EXEC@', $exec).Replace('@ARGS@', $argumentos).Replace('@DIR@', $dir).
    Replace('@LOGS@', (Join-Path $Base 'logs')).Replace('@CONTA@', $conta) | Set-Content $xml -Encoding UTF8
  if (Get-Service -Name $id -ErrorAction SilentlyContinue) {
    & $exe refresh | Out-Null
  } else {
    & $exe install | Out-Null
  }
  if ($LASTEXITCODE -ne 0) { Erro "WinSW não instalou $id (código $LASTEXITCODE). Veja $pasta\$id.wrapper.log." }
  Write-Host "  $id"
}

function Permitir-Reinicio([string]$servico) {
  # Dá à conta do runner: consultar, iniciar e parar este serviço (nada mais).
  $sid = (New-Object Security.Principal.NTAccount($RunnerConta)).Translate([Security.Principal.SecurityIdentifier]).Value
  $sd = ((sc.exe sdshow $servico) | Where-Object { $_ }) -join ''
  $ace = "(A;;RPWPLCLORC;;;$sid)"
  if ($sd -like "*$ace*") { return }
  $i = $sd.IndexOf('S:')
  $novo = if ($i -ge 0) { $sd.Substring(0, $i) + $ace + $sd.Substring($i) } else { $sd + $ace }
  sc.exe sdset $servico $novo | Out-Null
  if ($LASTEXITCODE -ne 0) { Erro "Não consegui dar ao runner permissão de reiniciar $servico." }
}

Passo 'Serviços do Windows'
$node = (Get-Command node).Source
$atual = Join-Path $Base 'current'
$localService = '<serviceaccount><domain>NT AUTHORITY</domain><user>LocalService</user></serviceaccount>'
$servicos = @()
foreach ($s in @(
    @{ n = 'api'; d = 'kernelpanic-backend'; a = 'dist\main.js' },
    @{ n = 'ingestao'; d = 'kernelpanic-backend'; a = 'dist-servicos\servicos\ingestao\main.js' },
    @{ n = 'tratamento'; d = 'kernelpanic-backend'; a = 'dist-servicos\servicos\tratamento\main.js' },
    @{ n = 'front'; d = 'frontend\frontend'; a = "node_modules\next\dist\bin\next start --hostname 127.0.0.1 --port $($cfg['FRONT_PORTA'])" }
  )) {
  $id = "$Prefixo-$($s.n)"
  Instalar-Servico $id $s.n $node $s.a (Join-Path $atual $s.d) $localService
  Permitir-Reinicio $id
  $servicos += $id
}
# Sobem no boot; o primeiro start de verdade é o do primeiro deploy (antes
# disso não existe $Base\current).

Passo "Caddy ($($cfg['DOMINIO']))"
$sites = Join-Path $CaddyDir 'sites'
$logsCaddy = Join-Path $CaddyDir 'logs'
New-Item -ItemType Directory -Path $sites, $logsCaddy -Force | Out-Null
$site = Join-Path $sites "$Prefixo.caddy"
$conteudo = (Get-Content (Join-Path $Aqui 'Caddyfile.modelo') -Raw -Encoding UTF8).Replace('@DOMINIO@', $cfg['DOMINIO']).Replace('@PORT@', $cfg['PORT']).
  Replace('@BASE@', ($Base -replace '\\', '/')).
  Replace('@INGESTAO_PORTA@', $cfg['INGESTAO_PORTA']).Replace('@FRONT_PORTA@', $cfg['FRONT_PORTA']).
  Replace('@LOG@', ((Join-Path $logsCaddy "$Prefixo.log") -replace '\\', '/'))
# UTF-8 sem BOM: o Set-Content do PowerShell 5.1 grava BOM.
[IO.File]::WriteAllText($site, $conteudo, (New-Object Text.UTF8Encoding($false)))
$caddyfile = Join-Path $CaddyDir 'Caddyfile'
# Caminho absoluto: import relativo depende da pasta em que o Caddy roda.
$import = 'import ' + ((Join-Path $sites '*.caddy') -replace '\\', '/')
if (-not (Test-Path $caddyfile) -or -not (Select-String -Path $caddyfile -SimpleMatch $import -Quiet)) {
  Add-Content $caddyfile $import
}
& $caddyExe validate --config $caddyfile --adapter caddyfile
if ($LASTEXITCODE -ne 0) { Erro "Caddyfile inválido: $caddyfile" }
# O Caddy guarda certificados em $CaddyDir\dados (e não no perfil da conta).
$contaCaddy = ''
$envCaddy = "<env name=`"XDG_DATA_HOME`" value=`"$CaddyDir\dados`"/><env name=`"XDG_CONFIG_HOME`" value=`"$CaddyDir\config`"/>"
Instalar-Servico 'caddy' 'caddy' $caddyExe "run --config $caddyfile --adapter caddyfile" $CaddyDir ($contaCaddy + $envCaddy)
if ((Get-Service caddy).Status -eq 'Running') {
  & $caddyExe reload --config $caddyfile --adapter caddyfile
} else {
  Start-Service caddy
}

Passo 'Firewall'
foreach ($porta in 80, 443) {
  $nome = "DATA PANIC HTTP $porta"
  if (-not (Get-NetFirewallRule -DisplayName $nome -ErrorAction SilentlyContinue)) {
    New-NetFirewallRule -DisplayName $nome -Direction Inbound -Protocol TCP -LocalPort $porta -Action Allow | Out-Null
  }
}
Write-Host '  80 e 443 liberadas. A porta MQTT das estações é liberada na instalação do Mosquitto (seção 7.2).'

$saudeLocal = "http://localhost:$($cfg['PORT'])/saude http://localhost:$($cfg['INGESTAO_PORTA'])/saude http://localhost:$($cfg['TRATAMENTO_PORTA'])/saude"
Write-Host ''
Write-Host 'Pronto. Falta:' -ForegroundColor Green
Write-Host @"
  1. Registrar o runner do GitHub neste servidor (seção 7.3), com o rótulo
       datapanic-$Ambiente
     e como serviço do Windows na conta $RunnerConta.
  2. No GitHub, Settings > Environments > $Ambiente > variáveis:
       URL_SAUDE             https://$($cfg['DOMINIO'])/api/saude
       SERVIDOR_BASE         $Base
       SERVIDOR_SERVICOS     $($servicos -join ' ')
       SERVIDOR_SAUDE_LOCAL  $saudeLocal
  3. Depois do primeiro deploy, uma vez, como Administrador: criar o primeiro
     administrador do sistema (o seed usa dependências de dev)
       cd $Base\current\kernelpanic-backend
       npm.cmd ci --ignore-scripts; npm.cmd run db:seed; npm.cmd prune --omit=dev
"@
