# Patches serveur formation (VPS)

Fichiers copiés dans `/home/ubuntu/torinvest-formation/` via `pull-forge-all.sh` (ou `pull-forge-assets.sh` pour JS/CSS seul).

## Déploiement rapide (VPS)

```bash
SHA=<commit-merge> curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps/pull-forge-all.sh" | bash
bash /home/ubuntu/torinvest-formation/deploy/vps/verify-formation-deploy.sh
```

Si `verify-formation-deploy.sh` est absent (ancien pull) :

```bash
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/verify-formation-deploy.sh" | bash -s /home/ubuntu/torinvest-formation
```

## 1. Progression `/api/progress`

Dans `server.js` (ou `app.js`) :

```javascript
const createProgressRouter = require("./server-patches/routes-progress");
const requireAuth = /* votre middleware session existant pour /api/me */;

app.use(
  createProgressRouter({
    dataDir: "/home/ubuntu/torinvest-formation/data",
    requireAuth,
  })
);
```

Test (connecté) :

```bash
curl -b cookies.txt -s https://app.torinvest-trading.com/api/progress
curl -b cookies.txt -s -X PUT https://app.torinvest-trading.com/api/progress \
  -H 'Content-Type: application/json' \
  -d '{"modules":{"intro":{"stepsDone":1,"totalSteps":12}}}'
```

## 2. Paywall Premium sur `/course/*`

**Avant** `express.static('public')` :

```javascript
const requireSubscribedForCourse = require("./server-patches/middleware-require-subscribed");
app.use(requireSubscribedForCourse);
```

## 3. Redémarrage

```bash
cd /home/ubuntu/torinvest-formation
pm2 restart torinvest-formation   # ou systemctl selon votre setup
```

## Sécurité contenu

Les HTML des 37 modules restent dans `public/course/` sur le VPS — ne pas les pousser sur le repo public GitHub.
