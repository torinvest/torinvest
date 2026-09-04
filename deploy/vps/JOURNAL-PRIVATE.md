# Trading Journal Pro — SSO La Forge

## Objectif
Connecté Premium sur `app.torinvest-trading.com` → Journal **sans** 2e login.

## Déploiement (VPS ubuntu)

```bash
# 1) Patch SSO sur trading_journal.php (radar)
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/patch-trading-journal-sso.sh" \
  | bash -s main

# 2) Proxy formation
APP=/home/ubuntu/torinvest-formation
REF=main
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/formation-server/routes-journal-bridge.js" \
  -o "$APP/server-patches/routes-journal-bridge.js"
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/la-forge/js/forge-journal.js" \
  -o "$APP/public/js/forge-journal.js"
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/app-shells/journal.html" \
  -o "$APP/public/journal.html"

# Secret = même que Fondamental (déjà dans ~/.profile en général)
# export FORGE_FONDAMENTAL_BRIDGE_SECRET='...'

pm2 restart la-forge --update-env
```

## Secours sans patch PHP

Si le SSO n’est pas encore sur `trading_journal.php`, le proxy peut auto-soumettre le login admin :

```bash
# dans ~/.profile puis pm2 restart la-forge --update-env
export FORGE_JOURNAL_USER='admin'
export FORGE_JOURNAL_PASSWORD='TON_MDP_JOURNAL'
```

## Vérif

```bash
curl -s https://app.torinvest-trading.com/api/journal-bridge/ping
# sso: true
grep -n torinvest-journal-forge-sso /var/www/torinvest/trading_journal.php
```
