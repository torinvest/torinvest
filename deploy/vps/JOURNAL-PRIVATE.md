# Trading Journal — hors GitHub public

Le build `appjournal/` **ne doit pas** être dans le dépôt GitHub (repo public),
comme `applifonda/`.

Il vit uniquement sur le VPS : `/var/lib/torinvest/appjournal`.

## Architecture (comme Fondamental)

```
Premium La Forge sur app.*
  → POST /api/journal-bridge/activate
  → HMAC bridge → radar /api/journal-access.php
  → cookie forge_journal_embed + sessionToken
  → iframe src=/appjournal/
  → Express proxy → radar /api/journal-serve.php
```

URL hub : https://app.torinvest-trading.com/journal.html

## Déployer l’API (sur le VPS)

```bash
cd /tmp
curl -fsSL -o pull-api.sh \
  https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/pull-api.sh
bash pull-api.sh
# ou :
curl -fsSL -o pull-journal.sh \
  https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/pull-journal.sh
bash pull-journal.sh main
```

Optionnel dans `api/config.local.php` :

```php
'journal_app_dir' => '/var/lib/torinvest/appjournal',
'journal_access_session_ttl' => 43200,
```

## Déployer l’app Journal (depuis ton PC)

Place le build (index.html + assets) sur le VPS :

```powershell
.\deploy\vps\push-appjournal.ps1 -Source "C:\chemin\vers\ton-journal\dist"
```

Ou manuellement :

```bash
sudo mkdir -p /var/lib/torinvest/appjournal
# scp / rsync du build → /var/lib/torinvest/appjournal/
sudo chown -R www-data:www-data /var/lib/torinvest/appjournal
```

## Déployer le hub formation

```bash
BRANCH=main curl -fsSL \
  "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/deploy-la-forge-full.sh" | bash
pm2 restart la-forge --update-env
```

## Smoke test

```bash
# ping bridge
curl -s https://app.torinvest-trading.com/api/journal-bridge/ping

# après login Premium + activate
curl -s -b cookies.txt https://app.torinvest-trading.com/api/journal-bridge/status
```

## Si ton journal est déjà ailleurs sur le VPS

Indique le chemin réel dans `config.local.php` :

```php
'journal_app_dir' => '/chemin/existant/vers/ton-journal',
```

Le serveur cherche aussi : `/var/www/torinvest/private/appjournal` et `/var/www/torinvest/appjournal`.
