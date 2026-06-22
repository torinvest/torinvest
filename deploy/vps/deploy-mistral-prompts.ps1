# Met a jour les prompts Mistral (date du jour) — NE TOUCHE PAS config.php
$ErrorActionPreference = "Stop"
$VpsHost = "ubuntu@164.132.46.191"
$Root = Split-Path (Split-Path $PSScriptRoot -Parent) -Parent
$files = @(
    "crypto-radar\mistral-prompt.php",
    "crypto-radar\ai_analysis.php",
    "crypto-radar\generate_global_press.php",
    "crypto-radar\update_analyses.php",
    "crypto-radar\ai_blog.php"
)
foreach ($f in $files) {
    scp (Join-Path $Root $f) "${VpsHost}:/tmp/"
}
scp (Join-Path $PSScriptRoot "install-mistral-prompts.sh") "${VpsHost}:/tmp/"
ssh $VpsHost "sed -i 's/\r$//' /tmp/install-mistral-prompts.sh; bash /tmp/install-mistral-prompts.sh"
Write-Host "Termine. Regenere la revue de presse sur le dashboard."
