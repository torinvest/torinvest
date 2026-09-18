# Déploie le fix dashboard sur le VPS (depuis Windows).
# Usage (PowerShell) :
#   .\deploy\vps\FIX-DASHBOARD-ACCESS.ps1
#
# Prérequis : OpenSSH client + clé SSH déjà configurée pour ubuntu@164.132.46.191

$ErrorActionPreference = "Stop"
$Vps = if ($env:TORINVEST_VPS) { $env:TORINVEST_VPS } else { "ubuntu@164.132.46.191" }
$Ref = if ($env:TORINVEST_DEPLOY_REF) { $env:TORINVEST_DEPLOY_REF } else { "cursor/fix-dashboard-access-691a" }
$Url = "https://raw.githubusercontent.com/torinvest/torinvest/$Ref/deploy/vps/FIX-DASHBOARD-ACCESS.sh"

Write-Host "SSH $Vps → FIX-DASHBOARD-ACCESS.sh (REF=$Ref)"
ssh $Vps "curl -fsSL '$Url' | bash"
if ($LASTEXITCODE -ne 0) { throw "Échec deploy (code $LASTEXITCODE). Tu dois pouvoir SSH sur le VPS." }

Write-Host ""
Write-Host "Vérif live :"
try {
  $r = Invoke-WebRequest -Uri "https://app.torinvest-trading.com/dashboard.html" -MaximumRedirection 0 -SkipHttpErrorCheck
  Write-Host "dashboard HTTP $($r.StatusCode) (attendu 200 après fix)"
} catch {
  Write-Host "dashboard redirect/erreur : $_"
}
Write-Host "Puis Ctrl+F5 https://app.torinvest-trading.com/login.html"
