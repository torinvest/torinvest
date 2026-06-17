#!/bin/bash
# A lancer SUR LE VPS apres copie des fichiers dans /tmp (scp ou WinSCP).
set -eu

for f in accompagnement-access.php accompagnement-access-lib.php http-session.php; do
  test -f "/tmp/$f" || { echo "Manquant : /tmp/$f"; exit 1; }
done
for f in accompagnement-gate.php config.php update.php portfolio.php blog.php blog_post.php stats.php portfolio_manager.php iron-poxy.php; do
  test -f "/tmp/$f" || { echo "Manquant : /tmp/$f"; exit 1; }
done

sudo mv /tmp/accompagnement-access.php /tmp/accompagnement-access-lib.php /var/www/torinvest/api/
sudo mv /tmp/http-session.php /var/www/torinvest/api/
sudo mv /tmp/accompagnement-gate.php /tmp/config.php /tmp/update.php /tmp/portfolio.php \
  /tmp/blog.php /tmp/blog_post.php /tmp/stats.php /tmp/portfolio_manager.php /tmp/iron-poxy.php \
  /var/www/torinvest/crypto-radar/

sudo chown www-data:www-data \
  /var/www/torinvest/api/accompagnement-access.php \
  /var/www/torinvest/api/accompagnement-access-lib.php \
  /var/www/torinvest/api/http-session.php \
  /var/www/torinvest/crypto-radar/accompagnement-gate.php \
  /var/www/torinvest/crypto-radar/config.php \
  /var/www/torinvest/crypto-radar/update.php \
  /var/www/torinvest/crypto-radar/portfolio.php \
  /var/www/torinvest/crypto-radar/blog.php \
  /var/www/torinvest/crypto-radar/blog_post.php \
  /var/www/torinvest/crypto-radar/stats.php \
  /var/www/torinvest/crypto-radar/portfolio_manager.php \
  /var/www/torinvest/crypto-radar/iron-poxy.php

php -l /var/www/torinvest/api/accompagnement-access.php
php -l /var/www/torinvest/crypto-radar/accompagnement-gate.php
sudo systemctl reload nginx
echo "OK - garde accompagnement installee."
