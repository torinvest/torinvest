# Déploie le build web USA War Atlas hors DocumentRoot public (comme applifonda).
# Usage :
#   .\deploy\vps\push-appliatlas.ps1 -Source "C:\laragon\www\torinvest\private\appliatlas\apps\web\dist"
#   .\deploy\vps\push-appliatlas.ps1 -Source ".\apps\web\dist" -Remote "ubuntu@vps"

param(
  [Parameter(Mandatory = $true)]
  [string]$Source,
  [string]$Remote = "ubuntu@vps-eb3cfb2f",
  [string]$Dest = "/var/lib/torinvest/appliatlas"
)

if (-not (Test-Path $Source)) {
  Write-Error "Source introuvable : $Source"
  exit 1
}

$index = Join-Path $Source "index.html"
if (-not (Test-Path $index)) {
  Write-Error "index.html manquant dans $Source — lancer le build Vite d'abord"
  exit 1
}

Write-Host "==> Sync $Source → ${Remote}:${Dest}"
ssh $Remote "sudo mkdir -p $Dest && sudo chown -R `$USER:`$USER $Dest"
rsync -avz --delete "$Source/" "${Remote}:${Dest}/"
ssh $Remote "sudo chown -R www-data:www-data $Dest && ls -la $Dest | head"
Write-Host "OK — Atlas déployé. Ctrl+Shift+R https://app.torinvest-trading.com/atlas.html"
