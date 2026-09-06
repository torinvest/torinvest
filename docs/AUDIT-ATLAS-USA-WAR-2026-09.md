# Correctif USA War Atlas — erreur JSON (sept. 2026)

## Constat (prod)

Sur `https://app.torinvest-trading.com/atlas.html`, l’embed affichait :

> Impossible de charger les données : Unexpected token '<', "<!DOCTYPE "… is not valid JSON

**Cause racine confirmée** : `/api/atlas-bridge/ping` renvoyait

```json
{ "api": "http://127.0.0.1:3001" }
```

Or La Forge écoute déjà sur **3001**. L’API Atlas doit être sur **3011** (`usa-war-atlas-api`). Le proxy renvoyait donc du HTML (SPA / 404) à la place du JSON.

## Manquement audit

L’audit « site + formation » a validé le *câblage documenté* (docs / scripts) sans **vérifier le runtime prod** du ping Atlas (`api` + santé upstream). C’est un trou de couverture : un pont « monté » avec mauvais `FORGE_ATLAS_API_URL` passe un audit statique.

## Correctifs (cette branche)

1. **Garde-fou bridge** : si `FORGE_ATLAS_API_URL` pointe vers le port de La Forge → forcer `http://127.0.0.1:3011`.
2. **Proxy** : si l’upstream renvoie du HTML → **502 JSON** (plus de HTML vers la SPA).
3. **Gate Premium API** : `/atlas-embed/api/*` refuse en **JSON** (plus de HTML via `Accept: */*`).
4. **Ping** : expose `apiHealth` (probe `/api/health` sur 3011).
5. **SPA** : détection HTML + message d’erreur orienté prod (plus de « npm run dev »).
6. **Script VPS** : `deploy/vps/fix-atlas-api-url.sh` — corrige `.env`, redémarre PM2, vérifie le ping.

## Déploiement immédiat VPS

```bash
# 1) Correctif env + process (rapide)
curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/atlas-usa-war-fix-691a/deploy/vps/fix-atlas-api-url.sh | bash

# 2) Puis pull du bridge (après merge) via pull-forge-all / deploy-atlas-vps
```

Vérif :

```bash
curl -sS https://app.torinvest-trading.com/api/atlas-bridge/ping
# attendu : "api":"http://127.0.0.1:3011" et apiHealth.ok === true
```
