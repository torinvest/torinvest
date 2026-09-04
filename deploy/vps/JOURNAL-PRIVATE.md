# Trading Journal Pro — intégration La Forge

## Source live

- URL radar : https://radar.torinvest-trading.com/trading_journal.php
- Fichier VPS : `/var/www/torinvest/trading_journal.php`
- Local Laragon : `C:\laragon\www\autoresearch-main\trading_journal.php`

## Pourquoi pas d’iframe radar directe ?

Helmet sur `app.torinvest-trading.com` a :

`frame-src 'self' https://www.tradingview.com`

→ l’iframe vers radar est **bloquée** (« Ce contenu a été bloqué »).

## Solution

Proxy same-origin :

```
/journal-embed/  →  https://radar.torinvest-trading.com/trading_journal.php
```

Gate Premium La Forge → iframe `/journal-embed/` (passe le CSP).

## Déployer (VPS ubuntu)

```bash
APP=/home/ubuntu/torinvest-formation
REF=main   # ou cursor/journal-radar-embed-691a si pas encore mergé

curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/formation-server/routes-journal-bridge.js" \
  -o "$APP/server-patches/routes-journal-bridge.js"
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/la-forge/js/forge-journal.js" \
  -o "$APP/public/js/forge-journal.js"
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/app-shells/journal.html" \
  -o "$APP/public/journal.html"

# optionnel secours CSP
node "$APP/deploy/vps/patch-helmet-journal-frames.js" "$APP" 2>/dev/null || \
  curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/patch-helmet-journal-frames.js" | node - "$APP"

pm2 restart la-forge --update-env
```

Test :

```bash
curl -s https://app.torinvest-trading.com/api/journal-bridge/ping
# → upstream trading_journal.php
```

Puis Ctrl+Shift+R https://app.torinvest-trading.com/journal.html
