# Corrige Masterclass HTTP 404 (API non montée) — depuis Windows.
# Usage (PowerShell) :
#   .\deploy\vps\FIX-MASTERCLASS-404.ps1
#
# Ou une seule ligne (copier-coller dans PowerShell) :
#   ssh ubuntu@164.132.46.191 "curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/HOTFIX-MASTERCLASS-404.sh -o /tmp/hotfix-mc.sh && bash /tmp/hotfix-mc.sh"
#
# Prérequis : OpenSSH + accès SSH déjà OK vers ubuntu@164.132.46.191

$ErrorActionPreference = "Stop"
$Vps = if ($env:TORINVEST_VPS) { $env:TORINVEST_VPS } else { "ubuntu@164.132.46.191" }
$Ref = if ($env:TORINVEST_DEPLOY_REF) { $env:TORINVEST_DEPLOY_REF } else { "main" }
$Url = "https://raw.githubusercontent.com/torinvest/torinvest/$Ref/deploy/vps/HOTFIX-MASTERCLASS-404.sh"

Write-Host "SSH $Vps → HOTFIX-MASTERCLASS-404.sh (REF=$Ref)"
ssh $Vps "curl -fsSL '$Url' -o /tmp/hotfix-mc.sh && bash /tmp/hotfix-mc.sh"
if ($LASTEXITCODE -ne 0) {
  throw "Échec deploy (code $LASTEXITCODE). Tu dois pouvoir SSH sur le VPS depuis ce PC."
}

Write-Host ""
Write-Host "Vérif live :"
try {
  $html = Invoke-WebRequest -Uri "https://app.torinvest-trading.com/masterclass.html" -UseBasicParsing
  Write-Host "masterclass.html → $($html.StatusCode)"
} catch {
  Write-Host "HTML erreur : $_"
}
try {
  $api = Invoke-WebRequest -Uri "https://app.torinvest-trading.com/api/masterclass/catalog" -UseBasicParsing -SkipHttpErrorCheck
  Write-Host "api/masterclass/catalog → $($api.StatusCode) (attendu 401 sans cookie, plus 404)"
} catch {
  Write-Host "API : $_"
}
Write-Host "Puis Ctrl+Shift+R sur https://app.torinvest-trading.com/masterclass.html"
