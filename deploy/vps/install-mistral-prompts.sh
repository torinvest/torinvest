#!/bin/bash
# Prompts Mistral temps reel — sans toucher config.php (cles).
set -euo pipefail
for f in mistral-prompt.php ai_analysis.php generate_global_press.php update_analyses.php ai_blog.php; do
  test -f "/tmp/$f" || { echo "Manquant: /tmp/$f"; exit 1; }
  sudo mv "/tmp/$f" "/var/www/torinvest/crypto-radar/$f"
done
sudo chown www-data:www-data /var/www/torinvest/crypto-radar/mistral-prompt.php /var/www/torinvest/crypto-radar/ai_analysis.php /var/www/torinvest/crypto-radar/generate_global_press.php /var/www/torinvest/crypto-radar/update_analyses.php /var/www/torinvest/crypto-radar/ai_blog.php
echo "OK — prompts Mistral a jour (config.php intact)."
