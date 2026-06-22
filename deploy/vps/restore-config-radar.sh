#!/bin/bash
# Restaure config.php radar sur le VPS (cles Mistral + garde accompagnement).
# Usage PC : scp ce script + config.php puis bash, OU depuis PC :
#   scp torinvest-main-git/crypto-radar/config.php ubuntu@164.132.46.191:/tmp/config.php
#   ssh ubuntu@164.132.46.191 'sudo cp /tmp/config.php /var/www/torinvest/crypto-radar/config.php && sudo chown www-data:www-data /var/www/torinvest/crypto-radar/config.php && sudo -u www-data php -r "require \"/var/www/torinvest/crypto-radar/config.php\"; echo count(DEFAULT_MISTRAL_API_KEYS).\" cle(s)\n\";"'

set -euo pipefail
sudo cp /tmp/config.php /var/www/torinvest/crypto-radar/config.php
sudo chown www-data:www-data /var/www/torinvest/crypto-radar/config.php
sudo -u www-data php -r 'require "/var/www/torinvest/crypto-radar/config.php"; echo count(DEFAULT_MISTRAL_API_KEYS)." cle(s) Mistral\n";'
echo "OK — config.php restaure."
