# Audit complet TORINVEST — 18 septembre 2026

**Périmètre :** marketing Netlify (`www`), CRM / licences, API radar (`radar`), formation La Forge (`app`), Stripe/Brevo, ponts Atlas / Journal / Fondamental / Books / TorPass / KRM, crypto-radar.

**Méthode :** revue code (repo `main` + branches) + sondes HTTP live le **2026-09-18**.  
**Branche :** `cursor/audit-complet-site-691a`  
**Précédent :** `docs/AUDIT-COMPLET-2026-09.md` (2026-09-06).  
**Suivant :** `docs/AUDIT-COMPLET-2026-09-19.md` (dashboard OK ; `/media` encore ouvert ; **nouveau** `radar/.git` exposé).

---

## Synthèse exécutive

| Zone | Niveau | Verdict live / code |
|------|--------|---------------------|
| Fuite vidéo `/media/*.mp4` | **Critique** | **Confirmé live : HTTP 200, ~380 Mo, sans session** |
| Dashboard formation | **Haut** | **HTTP 302 → login** (fix #123 mergé, **non déployé VPS**) |
| Secrets HEAD | OK | Pas de clés live dans l’arbre actuel |
| Secrets historique git | Critique | `COPY_TOKEN` toujours dans l’historique (`d00b7e7`) |
| Dual cookie forge/natif | Haut | Cause racine dashboard ; patch dans repo, absent du VPS |
| CSRF `SameSite=None` | Haut | Inchangé |
| Open redirect `accompagnement-access` | Haut | `?return=` sans allowlist — confirmé code + live HTML |
| AdSense avant consentement | Haut | Absent homepage ; **encore** dans `formation.html` `<head>` |
| Liens admin publics | Moyen* | Toujours dans nav/footer (*volontaire après restore*) |
| Atlas / Journal / Books bridges | OK | Pings `ok:true` ; Atlas API `:3011` ; 107 PDF books |
| Course paywall HTML | OK | `/course/index.html` → 302 login (anon) |
| Stripe / Brevo / CRM | Bon | Architecture saine ; password_plain encore en SQLite CRM |

\* Les liens admin ont été retirés puis **ré-ajoutés** à la demande ops — risque de découverte inchangé, PIN reste la barrière.

---

## Architecture (3 surfaces)

```
www.torinvest-trading.com   Netlify static + _redirects
radar.torinvest-trading.com PHP API + crypto-radar + journal
app.torinvest-trading.com   Node La Forge (PM2 :3001) + bridges
```

| Surface | Contenu clé |
|---------|-------------|
| Marketing | `index.html`, `la-forge/`, `formation.html`, TorPass, chroniques |
| CRM | `admin-licence/`, `api/admin-licence.php`, Brevo, Stripe webhook |
| Formation | `deploy/vps/app-shells/*`, `formation-server/*`, `users.json` VPS |
| Apps privées VPS | Fondamental, Atlas (`:3011`), Journal, books PDF |

---

## Sondes live (2026-09-18)

### www — OK
| URL | Code |
|-----|------|
| `/`, `/formation.html`, `/la-forge/`, `/la-forge/pricing.html`, `/torpass.html` | 200 |
| `/ai-access.html`, `/admin-licence/`, `/admin-krm-services.html` | 200 (PIN) |
| `/crypto-radar/` | 301 → radar |

### app — formation
| URL | Code | Note |
|-----|------|------|
| `/login.html`, `/start.html`, `/calendar.html` | 200 | |
| `/fondamental.html`, `/journal.html`, `/atlas.html`, `/books.html` | 200 | Gate client |
| `/dashboard.html` | **302** | → `login.html?next=/dashboard.html` — **bloquant membres** |
| `/course/index.html` | 302 | Paywall OK (anon) |
| `/course/videos/module-0-socle.mp4` | 302 | Auth OK |
| `/media/module-0-socle.mp4` | **200** | **FUITE ~380 Mo** |
| `/api/me` (anon) | 401 | Attendu |

### Bridges / API
| Endpoint | Résultat |
|----------|----------|
| `/api/accompagnement-auth/ping` | ok, licenseLogin |
| `/api/fondamental-bridge/ping` | ok, mounted |
| `/api/journal-bridge/ping` | ok → radar journal |
| `/api/atlas-bridge/ping` | ok, api `127.0.0.1:3011` |
| `/api/books/ping` | ok, **107** PDF |
| `/api/live-resources/ping` | ok, 1 pack |
| radar `/api/access-config.php` | ok |

---

## Findings (priorisés)

### CRITIQUE

#### C1 — Vidéo Premium publique (`/media/`)
- **Preuve :** `curl -sI https://app.torinvest-trading.com/media/module-0-socle.mp4` → `200`, `Content-Type: video/mp4`, `Content-Length: 379952889`.
- Contredit `deploy/vps/VIDEO-AUTH.md` (attendu 404).
- **Fix immédiat :**  
  `ssh ubuntu@164.132.46.191 'curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/audit-complet-site-691a/deploy/vps/FIX-MEDIA-PUBLIC.sh | bash'`

#### C2 — Token Worker dans l’historique git
- Commit `d00b7e7` ; fichier retiré du HEAD mais récupérable.
- **Action :** rotation `COPY_TOKEN` / secrets Worker + VPS si pas déjà fait.

### HAUT

#### H1 — Dashboard inaccessible (session forge)
- Cause : `requireAuth` natif (`torinvest_session`) ignore `torinvest_forge_sess`.
- Fix code **mergé** (#123) : route publique dashboard + `requireAuth` forge-aware + shim early.
- **Live encore cassé** tant que le script VPS n’est pas lancé :  
  `ssh ubuntu@164.132.46.191 'curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/FIX-DASHBOARD-ACCESS.sh | bash'`

#### H2 — CSRF cookies `SameSite=None` (www ↔ radar)
- `api/http-session.php` — pas d’Origin fail-closed systématique sur POST.
- **Fix :** allowlist Origin/Referer + CSRF token CRM.

#### H3 — Open redirect post-login Crypto Radar
- `accompagnement-access.html` : `window.location.replace(returnUrl)` sans allowlist.
- **Fix :** n’autoriser que chemins same-origin `/crypto-radar…` ou host `radar.torinvest-trading.com`.

#### H4 — Journal SSO → admin
- `api/trading-journal-forge-sso.php` élève `admin` / rôle admin.
- **Fix :** least-privilege membre.

#### H5 — AdSense avant consentement
- `formation.html` (et d’autres pages) chargent AdSense dans `<head>`.
- Homepage semble OK (0 hit `adsbygoogle` au sondage).
- **Fix :** uniquement via `torinvest-rgpd.js` après consentement marketing.

#### H6 — HMAC dérivé du PIN
- CRM / AI Access / member : si `*_hmac_secret` vide → PIN.
- **Fix :** secrets longs obligatoires en prod.

#### H7 — Mots de passe formation en clair (CRM)
- Table `formation_password_events.password_plain` + retour JSON CRM.
- Utile ops, risque si CRM compromis.
- **Fix :** chiffrement at-rest ou TTL + hash ; masquer après envoi Brevo.

#### H8 — Secret forge session par défaut
- `forge-session-shim.js` fallback `"torinvest-forge-session"` si env absent.
- **Fix :** exiger `FORGE_SESSION_SECRET` en prod.

### MOYEN

| ID | Sujet | Détail |
|----|--------|--------|
| M1 | Soft-gate membres | Chroniques / contenu HTML encore dans la réponse sans login |
| M2 | XSS `ai-access.html` | `innerHTML` avec messages erreur |
| M3 | `crypto-radar/crypto_cache.db` tracked | SQLite ~635 Ko dans git |
| M4 | KRM `list_my_requests` | Wallet client non prouvé |
| M5 | Progression partiellement client | `totalSteps` / scores |
| M6 | Scripts VPS `curl\|bash` | Mutations `server.js` fragiles (repair-wire existe) |
| M7 | Dual deploy surface | Netlify ≠ VPS ; merge GitHub ≠ prod formation |
| M8 | `iron-poxy.php` | Proxy IronFish + CORS previews |

### BAS / INFO

- Headers app : CSP Helmet présente (bonne).
- www : HSTS + XFO, **pas de CSP**.
- Books / live-resources / Atlas ping : sains.
- Form provision désactivé par défaut (webhook Stripe).
- Login self-serve + Brevo : documentés (`FORMATION-PASSWORD-SELFSERVE.md`).

---

## Matrice flux métier

| Flux | État |
|------|------|
| Stripe → licence → Brevo | OK (config dépendante) |
| CRM créer / provision formation | OK |
| Login email + mot de passe / TOR | OK (`accompagnement-auth/ping`) |
| Accès dashboard après login | **KO live** (deploy manquant) |
| Course HTML paywall | OK |
| Vidéo Module 0 via `/course/videos` | OK (302 anon) |
| Vidéo via `/media` | **KO — fuite** |
| Fondamental / Journal / Atlas / Books | Bridges OK |
| TorPass / KRM | Surfaces présentes ; admin lié publiquement |

---

## Dette ops (process)

1. **Ne jamais** lancer les scripts FIX depuis Windows/WSL — uniquement `ubuntu@164.132.46.191`.
2. Après chaque merge formation → **toujours** un script VPS (pas d’auto-deploy).
3. Éviter d’empiler des patches `server.js` sans `node --check` + backup (les scripts le font).
4. `.env` VPS : sauver en LF (CRLF a cassé Atlas).

---

## Actions immédiates (ordre)

1. **P0** Couper `/media` public → `FIX-MEDIA-PUBLIC.sh`
2. **P0** Déployer accès dashboard → `FIX-DASHBOARD-ACCESS.sh` (déjà sur `main`)
3. **P0** Confirmer rotation secrets Worker (historique git)
4. **P1** Allowlist `return=` accompagnement-access
5. **P1** Retirer AdSense head hors RGPD (`formation.html` + pages restantes)
6. **P1** Origin fail-closed + CSRF APIs cookie
7. **P2** Untrack `crypto_cache.db` ; Journal SSO least-privilege ; HMAC secrets dédiés

---

## Correctifs livrés dans ce PR

1. Ce rapport (`docs/AUDIT-COMPLET-2026-09-18.md`)
2. Script urgent `deploy/vps/FIX-MEDIA-PUBLIC.sh`
3. Pointeur depuis l’audit de sept. 06

---

*Audit code + live TORINVEST — 2026-09-18*
