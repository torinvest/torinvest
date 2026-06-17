# Deploie la garde accompagnement + Crypto Radar sur le VPS (depuis ton PC).
# Usage PowerShell :
#   cd "...\torinvest-main-git\deploy\vps"
#   .\deploy-accompagnement-gate.ps1

$ErrorActionPreference = "Stop"
$VpsHost = "ubuntu@164.132.46.191"
$RemoteTmp = "${VpsHost}:/tmp/"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent

$apiFiles = @(
    "api\accompagnement-access.php",
    "api\accompagnement-access-lib.php",
    "api\http-session.php"
)

$radarFiles = @(
    "crypto-radar\accompagnement-gate.php",
    "crypto-radar\config.php",
    "crypto-radar\update.php",
    "crypto-radar\portfolio.php",
    "crypto-radar\blog.php",
    "crypto-radar\blog_post.php",
    "crypto-radar\stats.php",
    "crypto-radar\portfolio_manager.php",
    "crypto-radar\iron-poxy.php"
)

Write-Host "Upload vers ${VpsHost}:/tmp/ ..."
foreach ($f in ($apiFiles + $radarFiles)) {
    $local = Join-Path $Root $f
    if (-not (Test-Path $local)) { throw "Fichier manquant : $local" }
    scp $local $RemoteTmp
}

$installScript = Join-Path $PSScriptRoot "install-on-vps.sh"
scp $installScript $RemoteTmp

Write-Host "Installation sur le VPS ..."
ssh $VpsHost "sed -i 's/\r$//' /tmp/install-on-vps.sh; chmod +x /tmp/install-on-vps.sh; bash /tmp/install-on-vps.sh"
Write-Host "Termine."
