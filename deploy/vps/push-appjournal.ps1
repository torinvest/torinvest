# Déploie le build Trading Journal hors DocumentRoot public (comme applifonda).
# Usage :
#   .\deploy\vps\push-appjournal.ps1 -Source "C:\chemin\vers\journal\dist"
#   .\deploy\vps\push-appjournal.ps1 -Source ".\dist" -Remote "ubuntu@vps"

param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [string]$Remote = "ubuntu@vps-eb3cfb2f",
  [string]$Dest = "/var/lib/torinvest/appjournal"
)

if (-not (Test-Path $Source)) {
  Write-Error "Source introuvable : $Source"
  exit 1
}

$index = Join-Path $Source "index.html"
if (-not (Test-Path $index)) {
  Write-Error "index.html manquant dans $Source"
  exit 1
}

Write-Host "==> Sync $Source → ${Remote}:${Dest}"
ssh $Remote "sudo mkdir -p $Dest && sudo chown -R `$USER:`$USER $Dest"
rsync -avz --delete "$Source/" "${Remote}:${Dest}/"
ssh $Remote "sudo chown -R www-data:www-data $Dest && ls -la $Dest | head"
Write-Host "OK — Journal déployé. Ctrl+Shift+R https://app.torinvest-trading.com/journal.html"
