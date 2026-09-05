# USA War Atlas — hors accès public direct

Source : `private/appliatlas/`  
Build web : `/var/lib/torinvest/appliatlas`  
API Node (PM2) : `127.0.0.1:3011` (≠ La Forge qui est sur **3001**)  
Proxy Premium : `/atlas-embed/api/*` → API

## Accès

- Hub : `https://app.torinvest-trading.com/atlas.html`
- Embed Premium : `/atlas-embed/`
- Alias : `/appliatlas/` (même build ; préférer `/atlas-embed/`)

## Déploiement VPS (recommandé — 1 commande)

Sur le VPS en **bash** (pas PowerShell) :

```bash
REF=e90635c   # ou le SHA / branche mergée
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/deploy-atlas-vps.sh" | bash
```

Le script :
1. télécharge `private/appliatlas`
2. build API + web (`VITE_BASE=/atlas-embed/`)
3. installe le dist dans `/var/lib/torinvest/appliatlas`
4. démarre `usa-war-atlas-api` sur **:3011**
5. `pull-forge-all` + restart `la-forge` avec `FORGE_ATLAS_*`

## Build manuel (si besoin)

```bash
cd /home/ubuntu/usa-war-atlas   # ou private/appliatlas syncé
npm install

# .env
cp -n .env.example .env
# API_PORT=3011
# CORS_ORIGIN=https://app.torinvest-trading.com
# DATABASE_URL="file:./prod.db"

npm run db:generate
npm run db:deploy
npm run db:seed || true
npm run build -w @usa-war-atlas/shared
npm run build -w @usa-war-atlas/api
npm run build:forge   # = VITE_BASE=/atlas-embed/ + VITE_API_URL=/atlas-embed

sudo mkdir -p /var/lib/torinvest/appliatlas
sudo rsync -a --delete apps/web/dist/ /var/lib/torinvest/appliatlas/
sudo chown -R www-data:www-data /var/lib/torinvest/appliatlas

pm2 delete usa-war-atlas-api 2>/dev/null || true
pm2 start scripts/ecosystem.config.cjs
pm2 save

# Formation
echo 'FORGE_ATLAS_APP_DIR=/var/lib/torinvest/appliatlas' >> ~/torinvest-formation/.env
echo 'FORGE_ATLAS_API_URL=http://127.0.0.1:3011' >> ~/torinvest-formation/.env
REF=e90635c curl -fsSL \
  "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-all.sh" | bash
pm2 restart la-forge --update-env
```

## Vérifs

```bash
curl -sS http://127.0.0.1:3011/api/health
curl -sS https://app.torinvest-trading.com/api/atlas-bridge/ping
# → hasIndex: true
```

Puis ouvrir `https://app.torinvest-trading.com/atlas.html` avec un compte **Premium**.

## Erreurs fréquentes

| Symptôme | Cause | Fix |
|----------|-------|-----|
| `cd private\appliatlas` échoue | syntaxe Windows sur bash | `cd private/appliatlas` |
| `$env:VITE_…` échoue | PowerShell sur bash | `export VITE_BASE=/atlas-embed/` |
| `EADDRINUSE :3001` | collision avec la-forge | `API_PORT=3011` |
| iframe blanche / 503 | dist absent | vérifier `/var/lib/torinvest/appliatlas/index.html` |
| API 502 dans embed | mauv. URL proxy | `FORGE_ATLAS_API_URL=http://127.0.0.1:3011` + `pm2 restart la-forge --update-env` |
| Carte noire / sans tuiles | CSP Helmet bloque `blob:` workers MapLibre ou tuiles CARTO | `pull-forge-all` (bridge CSP atlas) + `node patch-helmet-journal-frames.js` puis `pm2 restart la-forge` |
| Popup → 404 hors Atlas | lien `/conflits/…` sans `VITE_BASE` | rebuild web avec `npm run build:forge` (`VITE_BASE=/atlas-embed/`) |
