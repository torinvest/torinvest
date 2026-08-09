# Déploie le build Fondamental vers le VPS (hors GitHub public).
# Prérequis : dossier local du build (ex. C:\laragon\www\fondamental\dist
#             ou un dossier applifonda\ déjà buildé).
#
# Usage (PowerShell sur ton PC) :
#   cd chemin\vers\torinvest
#   .\deploy\vps\push-applifonda.ps1
#   .\deploy\vps\push-applifonda.ps1 -Source "C:\laragon\www\fondamental\dist"

param(
    [string]$VpsHost = "ubuntu@164.132.46.191",
    [string]$Source = "",
    [string]$RemoteApp = "/var/lib/torinvest/applifonda"
)

$ErrorActionPreference = "Stop"

if (-not $Source) {
    $candidates = @(
        (Join-Path $PSScriptRoot "..\..\applifonda"),
        "C:\laragon\www\fondamental\dist",
        "C:\laragon\www\applifonda"
    )
    foreach ($c in $candidates) {
        if (Test-Path (Join-Path $c "index.html")) {
            $Source = $c
            break
        }
    }
}

if (-not $Source -or -not (Test-Path (Join-Path $Source "index.html"))) {
    Write-Error "Build introuvable. Passe -Source 'chemin\vers\dist' (doit contenir index.html)."
}

Write-Host "==> Source : $Source"
Write-Host "==> Cible  : ${VpsHost}:${RemoteApp}"

# Upload vers /tmp puis rsync atomique hors webroot
ssh $VpsHost "rm -rf /tmp/applifonda-upload && mkdir -p /tmp/applifonda-upload"
scp -r "$Source\*" "${VpsHost}:/tmp/applifonda-upload/"
ssh $VpsHost "sudo mkdir -p '$RemoteApp' && sudo rsync -a --delete /tmp/applifonda-upload/ '$RemoteApp/' && sudo chown -R www-data:www-data /var/lib/torinvest && rm -rf /tmp/applifonda-upload && echo OK && ls '$RemoteApp' | head"

Write-Host "Déployé. Test :"
Write-Host "  curl -sI 'https://www.torinvest-trading.com/applifonda/assets/x.js' | head"
Write-Host "Attendu: 401 sans session"
