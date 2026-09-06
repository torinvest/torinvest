# Audit complet TORINVEST — septembre 2026

**Périmètre :** site public (`www.torinvest-trading.com`), CRM licences, API radar, formation La Forge (`app.torinvest-trading.com`), paiements Stripe/Brevo, ponts Atlas / Journal / Fondamental / TorPass / KRM.

**Date :** 2026-09-06  
**Branche :** `cursor/audit-complet-site-691a`

---

## Synthèse exécutive

| Zone | Niveau | Verdict |
|------|--------|---------|
| Secrets dans le dépôt (HEAD) | OK | Pas de clés live dans l’arbre actuel |
| Secrets dans l’**historique** git | Critique | Ancien `COPY_TOKEN` récupérable → **rotation** |
| Stripe webhook | Bon | HMAC + fenêtre temporelle + idempotence |
| CRM → Brevo | Bon | Envoi à la création CRM + renvoi manuel |
| Sessions cookie `SameSite=None` | Haut | Pas de contrôle Origin fail-closed (CSRF) |
| Formation — progression | Haut | `totalSteps` / scores encore partiellement client |
| Formation — vidéos | Haut | Dépendance à l’ordre des middlewares ; risque `/media` public (PR vidéo) |
| Site marketing — admin links | Haut | Liens CRM/KRM dans nav + footer publics |
| RGPD AdSense | Haut | Script AdSense en `<head>` avant consentement |
| Soft-gate membres | Moyen | Contenu HTML toujours dans la réponse |
| Journal SSO / shared password | Haut | Compte Journal partagé possible |

---

## Surfaces cartographiées

1. **Marketing Netlify** — HTML racine, `la-forge/`, activation, TorPass, espace membre  
2. **API radar** (`api/*.php`) — CRM, Stripe, Brevo, AI Access, Atlas/Journal/Fondamental, membres, KRM  
3. **CRM** — `admin-licence/`  
4. **Formation VPS** — `deploy/vps/formation-server/` + `app-shells/` + contenu `private/course/`  
5. **Worker Cloudflare** — licences TOR-VIP / ACCOMPAGNEMENT  

---

## Findings détaillés

### CRITIQUE

#### C1 — Token Worker encore dans l’historique git
- Commit historique a exposé un `copyToken` / `TOR_COPY_…` puis retiré.
- **Action :** rotation immédiate du secret Worker + VPS ; ne pas se fier à la suppression seule.

### HAUT

#### H1 — CSRF sur cookies `SameSite=None`
- Fichiers : `api/http-session.php`, `admin-licence.php`, `ai-access.php`, `member-auth.php`, …
- Cross-site www → radar ; pas de rejet Origin fail-closed sur POST.
- **Fix :** exiger Origin/Referer allowlist ; token CSRF CRM.

#### H2 — HMAC de session dérivé du PIN
- CRM / AI Access / member : secret HMAC = PIN si secret dédié absent.
- **Fix :** secrets longs obligatoires (`*_hmac_secret`), fail closed en prod.

#### H3 — Journal Forge SSO → flags admin
- `trading-journal-forge-sso.php` élève la session en `admin`.
- **Fix :** rôle least-privilege.

#### H4 — Liens admin publics (site)
- `index.html` nav/footer → `#admin`, `#crm`, `/admin-krm-services`.
- **Fix appliqué dans ce PR :** retrait des liens ; `robots.txt` Disallow KRM admin.

#### H5 — AdSense avant consentement RGPD
- Script AdSense hardcodé dans `<head>` de nombreuses pages ; contredit `cookies.html` + `torinvest-rgpd.js`.
- **Fix :** retirer le script head ; charger uniquement via RGPD après consentement marketing.

#### H6 — Vidéos formation / ordre middleware
- Route `/course/videos/:file` sans auth intrinsèque ; si montée avant paywall → fuite.
- Branche vidéo Module 0 : fallback `/media/:file` **public** = fuite Premium.
- **Fix :** auth **dans** le handler vidéo ; **jamais** `/media` public pour le contenu payant ; réencoder H.264.

#### H7 — Progression forgeable
- Client peut influencer `totalSteps` / scores (deltas plafonnés mais totaux partiellement trustés).
- **Fix :** plancher serveur + métadonnées leçon côté serveur (partiellement fait sur branche vidéo/audit).

#### H8 — Mots de passe Premium en dur dans scripts VPS
- `AdminFonda2026!`, `Forge2026!` dans scripts de repair/fix.
- **Fix appliqué :** variables d’environnement uniquement.

#### H9 — Journal auto-login env partagé
- Un seul `FORGE_JOURNAL_PASSWORD` pour tous les Premium.
- **Fix :** SSO par utilisateur uniquement ; supprimer fallback partagé.

### MOYEN

| ID | Sujet | Détail |
|----|--------|--------|
| M1 | Soft-gate membres | HTML chroniques accessible sans login (curl / view-source) |
| M2 | XSS `ai-access.html` | `err.message` / `data.plan` en `innerHTML` |
| M3 | Robot checkout « paused » | Liens Stripe encore en HTML brut |
| M4 | KRM `list_my_requests` | Wallet client non prouvé |
| M5 | `provision_key` en query | Logs / Referer |
| M6 | Login rate-limit XFF | Spoofable si proxy mal configuré |
| M7 | `Math.random` passwords | Utiliser `crypto.randomBytes` |
| M8 | Lib PHP non toutes denied | Étendre `.htaccess` `*-lib.php` |

### BAS / INFO

- Stripe + Brevo bien structurés côté serveur  
- Form provision désactivé par défaut (webhook only)  
- CORS Netlify preview credentials déjà coupé sur plusieurs endpoints  
- Headers Netlify (`_headers`) solides  
- Paywall HTML course + books/PDF côté serveur (quand middleware monté)  

---

## Flux métier

| Flux | État |
|------|------|
| Stripe → licence → Brevo | OK si clés configurées |
| CRM créer licence → Brevo | OK (PR récente) |
| Login Forge email + TOR-ACCOMPAGNEMENT | OK (binding email Worker) |
| Module 0 vidéo | En cours — ne pas laisser `/media` public |
| Soft-gate chroniques | Contenu non protégé serveur |

---

## Correctifs livrés dans ce PR

1. Rapport d’audit (`docs/AUDIT-COMPLET-2026-09.md`)  
2. Retrait liens admin/CRM/KRM de la homepage  
3. `robots.txt` : Disallow `/admin-krm-services`  
4. Scripts VPS : plus de mots de passe en dur (env vars)  

## Actions ops immédiates (hors code)

1. **Rotation** `COPY_TOKEN` / secrets Worker si pas déjà fait  
2. Sur VPS : supprimer route `/media/:file` publique si déployée ; servir uniquement `/course/videos/*` derrière session Premium  
3. Vérifier `brevo_api_key` + templates  
4. Activer secrets HMAC dédiés (ne plus signer avec le PIN)  
5. Plan RGPD : retirer AdSense du `<head>` sur toutes les pages  

## Priorités suivantes (backlog)

1. Origin fail-closed + CSRF sur APIs cookie  
2. Auth intrinsèque handler vidéo + unlock par module  
3. Progression 100 % serveur (catalogue `totalSteps`)  
4. Soft-gate → hard-gate CDN ou retirer du sitemap  
5. Journal SSO least-privilege + plus de password partagé  
6. Escape XSS `ai-access.html`  

---

*Audit code TORINVEST — 2026-09-06*
