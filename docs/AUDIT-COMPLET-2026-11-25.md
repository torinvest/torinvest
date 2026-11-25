# Audit TORINVEST — 25 novembre 2026 (Europe/Paris)

Audit **live** www + app + radar, croisé avec le code `main` (post-merge #242 / #243).

## Résumé exécutif

| Sévérité | Count |
|----------|------:|
| P0 Critiques | **2** |
| P1 Haut | **6** |
| P2 Moyen | **6** |
| P3 Bas / info | **4** |

**Bonne nouvelle :** pédagogie / guide écosystème (#243) et assets collectifs **sont déployés** sur `app` (start, dashboard, calendar, JS).  
**Mauvaise nouvelle :** API lives collectifs **non montée** (404) ; endpoints Brevo rappel/digest radar en **500** ; headers sécurité app absents.

## Architecture (inchangée)

| Surface | Host | Rôle |
|---------|------|------|
| Public | `www.torinvest-trading.com` (Netlify) | Marketing, soft membres, TorPass |
| Formation | `app.torinvest-trading.com` (VPS Node/PM2) | La Forge Premium |
| Radar | `radar.torinvest-trading.com` (PHP) | CRM, Brevo, bridges |

## Contrôles live — public www

| URL | Code | Note |
|-----|------|------|
| `/` | 200 | OK |
| `/la-forge/`, `/la-forge/pricing.html` | 200 | OK |
| `/activation.html`, `/espace-membre.html`, `/bootcamp.html`, `/crypto.html` | 200 | OK |
| `/confidentialite`, `/disclaimer`, `/cookies` | 200 | OK |
| `/ads.txt` | 200 | OK |
| `/media/*.mp4` | **404** | Critique sep **toujours fermée** |
| `/.git/HEAD` | **404** | OK |
| `/dev-access.html` | 200 | Page soft PIN exposée |
| `/admin-krm-services.html` | 200 | UI admin publique (gate client) |
| `/iron-poxy.php` | 200 | Proxy mining legacy exposé |
| Headers | HSTS, XFO, nosniff | **Pas de CSP** (`_headers`) |

## Contrôles live — app formation

| URL / API | Code | Note |
|-----------|------|------|
| `/login.html` | 200 | OK |
| `/dashboard.html`, `/start.html` | 200 | Guide écosystème **présent** |
| `/calendar.html` | 200 | Panel collectif + objectifs **présents** |
| `/js/forge-ecosystem-guide.js`, `forge-pedagogy.js`, `forge-collective-lives.js` | 200 | Deploy #243 OK |
| `/course/index.html`, `/course/module-01.html` | **302 → login** | Paywall serveur OK |
| `/crypto/index.html`, `/crypto/module.html` | **200** | **Pas de paywall serveur** |
| `/js/crypto-course-data.js` | 200 (~114 KB) | Curriculum crypto public |
| `/api/me`, `/api/progress`, `/api/coaching-lives`, `/api/journal-trades` | **401** | Auth OK |
| `/api/collective-lives` | **404** | Router **non wire** sur VPS |
| `/api/books/ping` | 200 | `pdfCount: 153` |
| `/api/books/list` | 401 | OK (login requis) |
| `/api/internal/formation-verify` | 401 | OK |
| Headers sécurité Express/Helmet | **absents** | Pas de CSP / HSTS / XFO côté app |

## Contrôles live — radar

| Endpoint | Code | Note |
|----------|------|------|
| `/` | 200 | OK |
| `/.git/HEAD` | 404 | OK |
| `POST /api/coaching-live-reminder.php` | **500** (body vide) | Attendu 401 ; **cassé** |
| `POST /api/collective-live-reminder.php` | **500** | Idem |
| `POST /api/weekly-digest.php` | **500** | Idem |

## Findings

### P0 — Critiques

| ID | Finding | Preuve | Action |
|----|---------|--------|--------|
| **P0-1** | CRM stocke encore `password_plain` | `api/admin-licence-lib.php` | Stop écriture + redact API list |
| **P0-2** | Rappels Brevo radar en **500** (coaching / collectif / digest) | Live POST → 500 vide | Fix PHP deploy (`brevo-lib` / provision) ; cibler 401 sans clé |

### P1 — Haut

| ID | Finding | Preuve | Action |
|----|---------|--------|--------|
| **P1-1** | Shells Premium HTML sans auth serveur | dashboard/books/atlases → 200 | `requireAuth` static avant public |
| **P1-2** | `/crypto/*` hors middleware Premium | 200 sans session | Étendre `middleware-require-subscribed.js` |
| **P1-3** | `/api/collective-lives` **404** (UI déployée, API absente) | Live 404 HTML fallback | Wire `routes-collective-lives` + pm2 restart |
| **P1-4** | App sans headers sécurité (Helmet off / bypass) | `curl -I` app | Réactiver patch Helmet |
| **P1-5** | CSP manquante sur www | `_headers` | Ajouter CSP Netlify |
| **P1-6** | XSS potentiel captions chart (`lesson-core.js`) | `innerHTML` caption non échappé | `esc()` captions |

### P2 — Moyen

| ID | Finding | Action |
|----|---------|--------|
| **P2-1** | Session shim default `"torinvest-forge-session"` | Fail boot si secret manquant |
| **P2-2** | Dual store MDP (membres vs `users.json`) | Sync change-password |
| **P2-3** | `iron-poxy.php` + pages legacy (`indexOLD`, `dev-access`) | Retirer / restreindre |
| **P2-4** | Curriculum crypto JS public (~114 KB) | Accepté ou gate serveur |
| **P2-5** | Ping books/atlas fuite ops (`pdfCount`, chemins) | Restreindre |
| **P2-6** | Drift `la-forge/dashboard` vs `app-shells/dashboard` | Shells = source de vérité |

### P3 — Bas

| ID | Note |
|----|------|
| **P3-1** | #243 assets pédagogiques bien déployés |
| **P3-2** | Coaching reminders job présent (logs historiques) ; mails radar KO |
| **P3-3** | 153 PDF livres prêts |
| **P3-4** | Formation trading gate serveur OK (302) |

## vs audit 21 nov 2026

| Item nov-21 | Statut 25 nov |
|-------------|---------------|
| `/media` public, `radar/.git` | **Toujours OK** (404) |
| `/course/*` paywall | **OK** |
| H1 `password_plain` | **Toujours ouvert** |
| M1 shells client-only | **Toujours ouvert** |
| M2 dual MDP | **Toujours ouvert** |
| M4 CSP www | **Toujours ouvert** |
| Rappels coaching Brevo | **Régression** (401 → 500) |
| Collective lives API | **Nouveau gap** (404) |
| Pédagogie / guide | **Déployé** (#243) |

## Priorités d’action (ordre)

1. **P0-2** Réparer radar reminder/digest (500 → auth 401 + Brevo OK)
2. **P1-3** Wire `createCollectiveLivesRouter` sur le VPS + restart PM2
3. **P0-1** Supprimer `password_plain`
4. **P1-2** Gate serveur `/crypto/*`
5. **P1-4** Headers Helmet app
6. **P1-5** CSP www
7. **P1-6** Escape captions chart
8. **P1-1** Auth serveur shells HTML

## Commandes deploy utiles

```bash
# Après fix radar + wire collective
SHA=<main> bash <(curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/$SHA/deploy/vps/HOTFIX-ECOSYSTEM-4UP.sh") all
SHA=<main> bash <(curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/$SHA/deploy/vps/HOTFIX-PEDAGOGY-GUIDE.sh")
```
