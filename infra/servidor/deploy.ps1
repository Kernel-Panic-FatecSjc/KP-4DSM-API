<#
.SYNOPSIS
  Instala uma versão do DATA PANIC no servidor Windows, ou volta para uma
  versão já instalada.

.DESCRIPTION
  Roda NO SERVIDOR (Windows Server 2025, Windows PowerShell 5.1). Quem chama:
    - o pipeline de CD, pelo runner do GitHub instalado no servidor
      (.github/workflows/deploy-vm.yaml);
    - a TI, à mão, no modo de produção manual: o GitHub Release da versão traz
      o pacote, o .sha256 e este script.

  Estrutura em $Base:
    releases\<sha>\     cada versão numa pasta (as 5 mais recentes ficam)
    current             junction para a versão no ar (os serviços apontam aqui)
    shared\.env         configuração do ambiente (nunca no pacote)
    bin\deploy.ps1      cópia deste script, para o rollback
    deploys.log         uma linha por deploy/rollback: quando, ação, versão, resultado, quem, run

  Deploy: extrai -> npm ci -> prisma migrate deploy -> tira as dependências de
  dev -> troca o current -> reinicia os serviços -> /saude. Se a saúde falhar,
  volta o current para a versão anterior e reinicia. ATENÇÃO: isso volta o
  CÓDIGO, não o banco. Por isso migrations seguem expand/contract (política de
  banco, seção 4): a versão anterior precisa funcionar com o schema novo.

.EXAMPLE
  .\deploy.ps1 -Sha <sha> -Pacote C:\temp\pacote-<sha>.tar.gz
.EXAMPLE
  C:\datapanic\bin\deploy.ps1 -Rollback              # volta para a anterior
.EXAMPLE
  C:\datapanic\bin\deploy.ps1 -Rollback -Sha <sha>   # volta para uma específica
#>
[CmdletBinding()]
param(
  [string]$Sha = '',
  [string]$Pacote = '',
  [switch]$Rollback,
  [string]$Base = 'C:\datapanic',
  [string]$Servicos = 'datapanic-api datapanic-ingestao datapanic-tratamento datapanic-front',
  [string]$Saude = 'http://localhost:3001/saude http://localhost:3002/saude http://localhost:3003/saude',
  [string]$DeployPor = $env:USERNAME,
  [string]$DeployRun = 'manual'
)

$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'

function Erro([string]$msg) { Write-Host "::error::$msg"; exit 1 }

# Comando nativo (npm, tar): o PowerShell 5.1 não para sozinho quando ele falha.
# npm.cmd/npx.cmd, e não npm: o npm.ps1 do Node pode ser barrado pela
# política de execução do Windows.
function Rodar([string]$descricao, [scriptblock]$bloco) {
  & $bloco
  if ($LASTEXITCODE -ne 0) { Erro "$descricao falhou (código $LASTEXITCODE)." }
}

function Registrar([string]$acao, [string]$versao, [string]$resultado) {
  $quando = (Get-Date).ToUniversalTime().ToString('yyyy-MM-ddTHH:mm:ssZ')
  $linha = @($quando, $acao, $versao, $resultado, $DeployPor, $DeployRun) -join "`t"
  Add-Content -Path (Join-Path $Base 'deploys.log') -Value $linha -Encoding UTF8
}

function Reiniciar {
  foreach ($s in ($Servicos -split '\s+' | Where-Object { $_ })) {
    Write-Host "  reiniciando $s"
    Restart-Service -Name $s -Force
  }
}

function Saudavel {
  foreach ($url in ($Saude -split '\s+' | Where-Object { $_ })) {
    $ok = $false
    for ($i = 0; $i -lt 30; $i++) {
      try {
        $r = Invoke-WebRequest -Uri $url -UseBasicParsing -TimeoutSec 5
        if ($r.StatusCode -eq 200) { $ok = $true; break }
      } catch { }
      Start-Sleep -Seconds 2
    }
    if (-not $ok) { Write-Host "::error::$url não respondeu"; return $false }
  }
  return $true
}

function VersaoAtual {
  $atual = Join-Path $Base 'current'
  if (Test-Path $atual) { return (Get-Item $atual).Target | Select-Object -First 1 }
  return ''
}

function Ativar([string]$pasta) {
  $atual = Join-Path $Base 'current'
  # rmdir numa junction remove só o link, nunca o conteúdo da versão.
  if (Test-Path $atual) { cmd /c rmdir "$atual" | Out-Null }
  New-Item -ItemType Junction -Path $atual -Target $pasta | Out-Null
  Reiniciar
}

$envCompartilhado = Join-Path $Base 'shared\.env'
if (-not (Test-Path $envCompartilhado)) {
  Erro "Falta $envCompartilhado. Rode infra\servidor\preparar-servidor.ps1 e preencha o .env (manual de instalação, seção 7)."
}
$releases = Join-Path $Base 'releases'
$anterior = VersaoAtual

# ---------------------------------------------------------------- rollback
if ($Rollback) {
  if ($Sha) {
    $alvo = Join-Path $releases $Sha
  } else {
    # A mais recente instalada que não é a atual.
    $alvo = Get-ChildItem $releases -Directory | Sort-Object LastWriteTime -Descending |
      Where-Object { $_.FullName -ne $anterior } | Select-Object -First 1 -ExpandProperty FullName
  }
  if (-not $alvo -or -not (Test-Path $alvo)) {
    Write-Host 'Instaladas:'; Get-ChildItem $releases -Directory | Sort-Object LastWriteTime -Descending | ForEach-Object { Write-Host "  $($_.Name)" }
    Erro "Versão $(if ($Sha) { $Sha } else { 'anterior' }) não está instalada."
  }
  $nome = Split-Path $alvo -Leaf
  Write-Host "== Rollback: $(Split-Path $anterior -Leaf) -> $nome (só o código; o banco fica como está)"
  Ativar $alvo
  if (Saudavel) { Registrar 'rollback' $nome 'ok'; Write-Host 'Rollback ok.'; exit 0 }
  Registrar 'rollback' $nome 'falha'
  Erro "A versão $nome também não ficou saudável: abra incidente e siga o runbook."
}

# ---------------------------------------------------------------- deploy
if ($Sha -notmatch '^[0-9a-f]{40}$') { Erro "Informe -Sha com o SHA completo (40 caracteres)." }
if (-not $Pacote -or -not (Test-Path $Pacote)) { Erro "Pacote não encontrado: $Pacote" }

$hash = Join-Path (Split-Path $Pacote) "pacote-$Sha.tar.gz.sha256"
if (Test-Path $hash) {
  $esperado = ((Get-Content $hash -Raw) -split '\s+')[0].ToLower()
  $obtido = (Get-FileHash $Pacote -Algorithm SHA256).Hash.ToLower()
  if ($esperado -ne $obtido) { Erro "SHA-256 do pacote não confere (esperado $esperado, obtido $obtido). Baixe de novo." }
  Write-Host 'SHA-256 do pacote confere.'
} else {
  Write-Host "::warning::Sem $hash ao lado do pacote: integridade não conferida."
}

$destino = Join-Path $releases $Sha
$api = Join-Path $destino 'kernelpanic-backend'
$web = Join-Path $destino 'frontend\frontend'

Write-Host '== Versões neste ambiente (política de banco 1.2)'
Rodar 'node -v' { node -v }
if (Get-Command psql -ErrorAction SilentlyContinue) { Write-Host '(psql disponível)' }

Write-Host "== Instalar $Sha"
if (Test-Path $destino) {
  if ($destino -eq $anterior) { Erro "$Sha já é a versão no ar. Para reinstalar, faça rollback antes." }
  Remove-Item $destino -Recurse -Force
}
New-Item -ItemType Directory -Path $destino | Out-Null
Rodar 'Extrair o pacote' { tar -xzf $Pacote -C $destino }
# O backend e os serviços leem o .env da própria pasta (dotenv).
Copy-Item $envCompartilhado (Join-Path $api '.env') -Force

# O CLI do Prisma é devDependency: instala tudo pelo lockfile, roda o migrate
# com a versão travada e só depois tira o que é de dev.
Push-Location $api
try {
  Rodar 'npm ci do backend' { npm.cmd ci --ignore-scripts --no-audit --no-fund }
  Rodar 'prisma --version' { npx.cmd --no-install prisma --version }
  Write-Host '== Migrations (expand/contract: não há volta automática do banco)'
  Rodar 'prisma migrate deploy' { npx.cmd --no-install prisma migrate deploy }
  Rodar 'npm prune do backend' { npm.cmd prune --omit=dev --no-audit --no-fund }
} finally { Pop-Location }

Push-Location $web
try {
  Rodar 'npm ci do front' { npm.cmd ci --omit=dev --ignore-scripts --no-audit --no-fund }
} finally { Pop-Location }

# Cópia do script fora das versões: o rollback não depende da versão quebrada.
$bin = Join-Path $Base 'bin'
New-Item -ItemType Directory -Path $bin -Force | Out-Null
Copy-Item (Join-Path $destino 'infra\servidor\deploy.ps1') (Join-Path $bin 'deploy.ps1') -Force

Write-Host '== Trocar current e reiniciar'
Ativar $destino

if (Saudavel) {
  Write-Host "Deploy de $Sha ok."
  Registrar 'deploy' $Sha 'ok'
  # Mantém as 5 versões mais recentes para rollback (nunca apaga a que está no ar).
  Get-ChildItem $releases -Directory | Sort-Object LastWriteTime -Descending | Select-Object -Skip 5 |
    Where-Object { $_.FullName -ne $destino } | ForEach-Object { Remove-Item $_.FullName -Recurse -Force -ErrorAction SilentlyContinue }
  exit 0
}

Write-Host "::error::$Sha não ficou saudável. Voltando o código para $(if ($anterior) { Split-Path $anterior -Leaf } else { 'nenhuma versão anterior' })."
Registrar 'deploy' $Sha 'falha'
if ($anterior) {
  Ativar $anterior
  if (Saudavel) { Registrar 'rollback-automatico' (Split-Path $anterior -Leaf) 'ok' }
  else {
    Registrar 'rollback-automatico' (Split-Path $anterior -Leaf) 'falha'
    Write-Host '::error::A versão anterior também não ficou saudável: abra incidente e siga o runbook.'
  }
}
exit 1
