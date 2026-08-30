# Patches serveur formation (VPS)

Fichiers copiés dans `/home/ubuntu/torinvest-formation/` via `pull-forge-all.sh` (ou `pull-forge-assets.sh` pour JS/CSS seul).

## Déploiement rapide (VPS) — tout en une commande

```bash
SHA=d70b955 curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps/finish-formation-vps-setup.sh" | bash
```

Avec sauvegarde privée des leçons :

```bash
SHA=d70b955 RUN_BACKUP=1 curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${SHA}/deploy/vps/finish-formation-vps-setup.sh" | bash
```

Le script : `pull-forge-all` → wire `server.js` → vérif fichiers + HTTP → restart PM2 (`la-forge` ou `torinvest-formation`).

## Déploiement manuel (étapes)

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

## 3. Calendrier `/api/calendar`

```javascript
const createCalendarRouter = require("./server-patches/routes-calendar");

app.use(
  createCalendarRouter({
    dataDir: "/home/ubuntu/torinvest-formation/data",
    requireAuth,
  })
);
```

Test (connecté) :

```bash
curl -b cookies.txt -s https://app.torinvest-trading.com/api/calendar
```

## 4. Wire automatique server.js

Si les patches ne sont pas encore dans `server.js` :

```bash
node /home/ubuntu/torinvest-formation/deploy/vps/wire-formation-server-patches.js
bash /home/ubuntu/torinvest-formation/deploy/vps/verify-formation-live.sh
```

## 5. Redémarrage

```bash
cd /home/ubuntu/torinvest-formation
pm2 restart torinvest-formation   # ou systemctl selon votre setup
```

## Sécurité contenu (intentionnel)

Les HTML des 37 modules restent **uniquement** dans `public/course/` sur le VPS. C’est le bon modèle : le paywall serveur (`middleware-require-subscribed`) empêche l’accès sans abonnement — ne pas publier ces fichiers sur GitHub public.

**Sauvegarde privée** (sur le VPS, sans exposer le contenu) :

```bash
bash /home/ubuntu/torinvest-formation/deploy/vps/backup-course-private.sh
```

Les archives restent sur le serveur (ex. `/home/ubuntu/backups/torinvest/`).

## Logos (CSP Helmet)

Helmet a `img-src 'self' data:` — les images `https://www.torinvest-trading.com/...` sont **bloquées** par le navigateur.

`pull-forge-assets.sh` copie les PNG dans `public/img/` et `public/la-forge/img/`. Le JS app utilise `/img/...` (même origine).

Si un logo manque encore :

```bash
ls /home/ubuntu/torinvest-formation/public/img/
curl -sI https://app.torinvest-trading.com/img/forge-anvil.png | head -5
```

Attendu : `HTTP/1.1 200`.

