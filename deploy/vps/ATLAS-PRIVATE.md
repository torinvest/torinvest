# USA War Atlas — hors accès public direct

Source monorepo : `private/appliatlas/` (USA_WAR_ATLAS).
Build web servi sous `/var/lib/torinvest/appliatlas`.
API Node (PM2) sur `127.0.0.1:3001`, proxifiée via `/atlas-embed/api/*`.

## Accès La Forge

- Hub : `https://app.torinvest-trading.com/atlas.html`
- Embed Premium : `/atlas-embed/` (session formation)
- Alias : `/appliatlas/`

## Build frontend (PC)

```powershell
cd C:\laragon\www\torinvest\private\appliatlas
npm install
$env:VITE_BASE="/atlas-embed/"
$env:VITE_API_URL="/atlas-embed"
npm run build -w @usa-war-atlas/web
.\deploy\vps\push-appliatlas.ps1 -Source ".\apps\web\dist"
```

## API sur le VPS

```bash
# Cloner / sync private/appliatlas sur le VPS, puis :
cd /var/www/usa-war-atlas   # ou chemin choisi
cp .env.example .env
# DATABASE_URL=file:./prod.db
# CORS_ORIGIN=https://app.torinvest-trading.com
# API_PORT=3001
npm install
npm run db:generate
npm run db:deploy
npm run db:seed          # premier déploiement
npm run build -w @usa-war-atlas/shared
npm run build -w @usa-war-atlas/api
pm2 start apps/api/dist/server.js --name usa-war-atlas-api
```

## Formation (bridge)

```bash
export FORGE_ATLAS_APP_DIR=/var/lib/torinvest/appliatlas
export FORGE_ATLAS_API_URL=http://127.0.0.1:3001
# puis pull-forge-all + wire auth + pm2 restart la-forge
```

## Vérif

```bash
curl -s https://app.torinvest-trading.com/api/atlas-bridge/ping
# hasIndex: true si le dist est déployé
```
