# Trading Journal Pro — intégration La Forge

## Source live (réelle)

- URL : https://radar.torinvest-trading.com/trading_journal.php
- Fichier VPS : `/var/www/torinvest/trading_journal.php` (hors repo Git public)
- Auth propre : login **Trading Journal Pro** (identifiant / mot de passe journal)
- Local Laragon (copie) : `C:\laragon\www\autoresearch-main\trading_journal.php`

Ce n’est **pas** le fichier statique `C:\laragon\www\torinvest-journal\trading-journal.html`.

## Hub formation

- https://app.torinvest-trading.com/journal.html
- Gate : session **La Forge Premium**
- Iframe → `trading_journal.php` sur radar (comme Fondamental ouvre applifonda)

## Déployer le hub (VPS ubuntu)

```bash
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/deploy-la-forge-full.sh" \
  | bash -s -- /home/ubuntu/torinvest-formation
pm2 restart la-forge --update-env
```

Ou pull partiel :

```bash
APP=/home/ubuntu/torinvest-formation
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/la-forge/js/forge-journal.js" \
  -o "$APP/public/js/forge-journal.js"
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/app-shells/journal.html" \
  -o "$APP/public/journal.html"
pm2 restart la-forge --update-env
```

## Mettre à jour le PHP journal sur radar

Depuis le PC (Laragon) :

```powershell
scp "C:\laragon\www\autoresearch-main\trading_journal.php" ubuntu@vps-eb3cfb2f:/tmp/trading_journal.php
```

Sur le VPS :

```bash
sudo mv /tmp/trading_journal.php /var/www/torinvest/trading_journal.php
sudo chown www-data:www-data /var/www/torinvest/trading_journal.php
```

## SSO (plus tard, optionnel)

Aujourd’hui : 2 logins (La Forge + Journal Pro).  
Plus tard : accepter la session formation (bridge) pour skip le login Journal.
