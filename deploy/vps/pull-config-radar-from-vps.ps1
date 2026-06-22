# Sauvegarde config.php radar depuis le VPS (cles incluses — gitignore).
# Usage :
#   cd "...\torinvest-main-git\deploy\vps"
#   .\pull-config-radar-from-vps.ps1

$ErrorActionPreference = "Stop"
$VpsHost = "ubuntu@164.132.46.191"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$Backup = Join-Path $Root "crypto-radar\config.vps-backup.php"

Write-Host "Telechargement config.php depuis le VPS..."
scp "${VpsHost}:/var/www/torinvest/crypto-radar/config.php" $Backup

Write-Host "OK -> $Backup"
Write-Host "Ce fichier est gitignore — ne le commit pas."
