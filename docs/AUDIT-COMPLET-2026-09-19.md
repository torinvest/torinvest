# Audit complet TORINVEST — site + formation — 19 septembre 2026

**Périmètre :** marketing Netlify (`www`), CRM / licences, API radar (`radar`), formation La Forge (`app`), Stripe/Brevo, ponts Atlas / Journal / Fondamental / Books / TorPass / KRM, crypto-radar.

**Méthode :** revue code (repo) + sondes HTTP anonymes live le **2026-09-19 ~11:37 UTC**.  
**Branche :** `cursor/audit-complet-19sep-691a`  
**Précédents :** `docs/AUDIT-COMPLET-2026-09-18.md`, `docs/AUDIT-COMPLET-2026-09.md`

---

## Synthèse exécutive

| Zone | Niveau | Verdict live 19/09 |
|------|--------|---------------------|
| Fuite vidéo `/media/*.mp4` | **Critique** | **Toujours 200, ~362 Mo, sans session** — `FIX-MEDIA-PUBLIC.sh` **non appliqué** |
| Exposition `radar/.git` | **Critique** | **Nouveau :** `/.git/HEAD`, `config`, `index`, refs → **200** (branche live lue) |
| Dashboard formation | **OK** | **200** HTML membre (corrigé vs 18/09 où 302 cassait l’accès) |
| Course paywall HTML | OK | `/course/index.html` → 302 login |
| Vidéo via `/course/videos` | OK | 302 login (anon) |
| Open redirect `accompagnement-access` | Haut | Confirmé live ; **fix code dans ce PR** |
| CSRF `SameSite=None` | Haut | Inchangé (`api/http-session.php`) |
| AdSense avant consentement | Haut | Encore dans `formation.html` `<head>` (homepage OK) |
| Admin UI publics | Moyen* | `/admin-licence/`, KRM, AI Access → 200 (PIN) |
| Bridges formation | OK | Pings `ok:true` (Atlas `:3011`, 107 PDF, journal SSO) |
| `password_plain` CRM | Haut | Toujours en SQLite + JSON CRM |
| Secrets historique git | Critique | `COPY_TOKEN` dans historique (`d00b7e7`) — rotation à confirmer |

\* Liens admin volontaires ops — PIN reste la barrière.

---

## Architecture (3 surfaces)

```
www.torinvest-trading.com   Netlify static + _redirects
radar.torinvest-trading.com PHP API + crypto-radar + journal  ← .git exposé
app.torinvest-trading.com   Node La Forge (PM2 :3001) + bridges  ← /media fuite
VPS 164.132.46.191          ubuntu — scripts curl|bash (pas d’auto-deploy)
```

| Surface | Contenu clé |
|---------|-------------|
| Marketing | `index.html`, `la-forge/`, `formation.html`, TorPass, chroniques |
| CRM | `admin-licence/`, `api/admin-licence.php`, Brevo, Stripe |
| Formation | shells `deploy/vps/app-shells/*`, `formation-server/*`, unlock batches |
| Privé VPS | Fondamental, Atlas `:3011`, Journal, books `/var/lib/torinvest/books` |

---

## Sondes live (2026-09-19)

### www — marketing
| URL | Code | Note |
|-----|------|------|
| `/`, `/formation.html` | 200 | AdSense ×1 dans formation.html |
| `/admin-licence/`, `/admin-krm-services.html`, `/ai-access.html` | 200 | PIN |
| `/.git/HEAD` | 404 | OK |
| `/robots.txt` | 200 | Disallow admin (aide découverte) |

### app — formation La Forge
| URL | Code | Note |
|-----|------|------|
| `/login.html`, `/forgot-password.html` | 200 | OK |
| `/dashboard.html` | **200** | **Réparé** (était 302 le 18/09) |
| `/start.html`, `/calendar.html`, `/fondamental.html`, `/journal.html`, `/atlas.html`, `/books.html` | 200 | Gate client |
| `/course/index.html` | 302 | → login — paywall OK |
| `/course/videos/module-0-socle.mp4` | 302 | Auth OK |
| `/media/module-0-socle.mp4` | **200** | **FUITE** `Content-Length: 379952889` ; range 206 OK |
| `/api/me`, `/api/progress`, `/api/books/list` | 401 | Attendu |
| `/.git/HEAD` | 404 | OK |

### radar
| URL | Code | Note |
|-----|------|------|
| `/.git/HEAD` | **200** | `ref: refs/heads/cursor/audit-improvements-691a` |
| `/.git/config`, `/.git/index`, `/.git/refs/heads/main` | **200** | Reconstruction repo possible |
| `/api/access-config.php` | 200 | `{ok, links}` (invites Discord/Telegram, worker URL) |

### Bridges (app)
| Endpoint | Résultat |
|----------|----------|
| `/api/accompagnement-auth/ping` | ok, licenseLogin |
| `/api/fondamental-bridge/ping` | ok, cookieFallback |
| `/api/journal-bridge/ping` | ok, SSO → radar journal |
| `/api/atlas-bridge/ping` | ok, api `127.0.0.1:3011`, forge_premium |
| `/api/books/ping` | ok, **107** PDF |
| `/api/live-resources/ping` | ok, 1 pack |

---

## Findings (priorisés)

### CRITIQUE

#### C1 — Vidéo Premium publique (`/media/`) — **toujours ouverte**
- **Preuve 19/09 :** `GET /media/module-0-socle.mp4` → `200`, `video/mp4`, **379 952 889** octets, `Cache-Control: public`, sans cookie.
- Contredit `deploy/vps/VIDEO-AUTH.md` (attendu 404).
- Le chemin correct `/course/videos/...` est bien protégé (302).
- **Fix immédiat (VPS uniquement) :**
  ```bash
  ssh ubuntu@164.132.46.191 'curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/FIX-MEDIA-PUBLIC.sh | bash'
  ```
- **Vérif :** `curl -sI https://app.torinvest-trading.com/media/module-0-socle.mp4` → **404** ; `/course/videos/...` → 302.

#### C2 — Dépôt Git exposé sur radar — **nouveau**
- **Preuve :** `https://radar.torinvest-trading.com/.git/HEAD` → 200 ; config + index + refs lisibles.
- Impact : dump complet du code API/CRM, historiques, éventuels secrets commités (dont `COPY_TOKEN` historique).
- Branche live visible : `cursor/audit-improvements-691a`.
- **Fix immédiat :**
  ```bash
  ssh ubuntu@164.132.46.191 'curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/audit-complet-19sep-691a/deploy/vps/FIX-RADAR-GIT-EXPOSE.sh | bash'
  ```
- **Vérif :** `curl -sI https://radar.torinvest-trading.com/.git/HEAD` → **403/404**.
- **Suite :** déplacer le working tree hors docroot ou déployer sans `.git` ; rotation secrets si dump possible.

#### C3 — Token Worker dans l’historique git
- Commit `d00b7e7` ; retiré du HEAD mais récupérable (aggravé par C2).
- **Action :** confirmer rotation `COPY_TOKEN` / secrets Worker + VPS.

---

### HAUT

#### H1 — Open redirect post-login Crypto Radar
- `accompagnement-access.html` : `window.location.replace(returnUrl)` sans allowlist.
- **Fix code :** allowlist hosts torinvest (livré dans ce PR).

#### H2 — CSRF cookies `SameSite=None` (www ↔ radar)
- `api/http-session.php` — cookies cross-subdomain ; Origin fail-closed incomplet sur POST.
- **Fix :** allowlist Origin/Referer + token CSRF CRM / access APIs.

#### H3 — Journal SSO → admin
- `api/trading-journal-forge-sso.php` élève rôle admin.
- **Fix :** least-privilege membre.

#### H4 — AdSense avant consentement RGPD
- `formation.html` charge `pagead2.googlesyndication.com` dans `<head>`.
- Homepage : 0 hit adsbygoogle.
- **Fix :** uniquement via `torinvest-rgpd.js` après consentement marketing.

#### H5 — Mots de passe formation en clair (CRM)
- Table `formation_password_events.password_plain` + JSON CRM.
- **Fix :** TTL + hash ; masquer après envoi Brevo ; chiffrement at-rest.

#### H6 — Secret forge session par défaut
- Fallback `"torinvest-forge-session"` si `FORGE_SESSION_SECRET` absent.
- **Fix :** exiger secret en prod (fail boot).

#### H7 — HMAC dérivé du PIN
- CRM / AI Access / member : secret vide → PIN.
- **Fix :** secrets longs obligatoires.

---

### MOYEN

| ID | Sujet | Détail |
|----|--------|--------|
| M1 | Soft-gate membres | HTML marketing soft-gated encore dans la réponse |
| M2 | XSS `ai-access.html` | `innerHTML` messages erreur |
| M3 | `crypto-radar/crypto_cache.db` | SQLite tracké ~635 Ko |
| M4 | KRM `list_my_requests` | Wallet client non prouvé |
| M5 | Progression partiellement client | `totalSteps` / scores |
| M6 | Scripts VPS `curl\|bash` | Mutations `server.js` fragiles |
| M7 | Dual deploy | Netlify ≠ VPS ; merge ≠ prod formation |
| M8 | Bridge pings | Fuite légère chemins internes (`appDir`, ports) |
| M9 | Shells membre 200 anon | Gate JS seulement (dashboard, fonda, journal…) |

### BAS / INFO

- Headers app : CSP Helmet + HSTS (bon).
- www : HSTS/XFO, **pas de CSP**.
- Login self-serve + Brevo documentés (`FORMATION-PASSWORD-SELFSERVE.md`).
- Dual cookie forge/natif : cause historique dashboard — **corrigé live** (dashboard 200).

---

## Formation — état fonctionnel

| Flux | État live |
|------|-----------|
| Login page + forgot-password | OK |
| `/api/me` anon | 401 OK |
| Dashboard après login | **OK** (shell 200 ; session via forge) |
| Course HTML paywall | OK (302) |
| Vidéo Module 0 `/course/videos` | OK (302) |
| Vidéo `/media` | **KO — fuite Premium** |
| Unlock modules (batches 3) | Code présent ; dépend VPS wire |
| Fondamental / Journal / Atlas / Books | Bridges OK |
| Accompagnement / licence login | Ping OK |
| CRM provision + Brevo | Architecture OK ; password_plain risque |
| Stripe → licence | OK (config-dépendante) |

---

## Matrice comparaison 18/09 → 19/09

| Item | 18/09 | 19/09 |
|------|-------|-------|
| `/media` fuite | Critique 200 | **Toujours Critique 200** |
| Dashboard 302 | Haut (cassé) | **OK 200** |
| `radar/.git` | Non sondé | **Critique 200 (nouveau)** |
| Course paywall | OK | OK |
| Bridges | OK | OK |
| Open redirect | Haut | Haut (+ fix repo) |

---

## Dette ops (process)

1. **Ne jamais** lancer les scripts FIX depuis Windows/WSL — uniquement `ubuntu@164.132.46.191`.
2. Après chaque merge formation → **toujours** un script VPS (pas d’auto-deploy).
3. Docroot radar : **ne pas** servir un checkout `.git` ; rsync/artefact sans `.git`.
4. `.env` VPS en LF (CRLF a cassé Atlas).

---

## Actions immédiates (ordre)

1. **P0** Couper `/media` → `FIX-MEDIA-PUBLIC.sh` (main)
2. **P0** Couper `radar/.git` → `FIX-RADAR-GIT-EXPOSE.sh` (cette branche)
3. **P0** Confirmer rotation secrets Worker (historique + dump .git possible)
4. **P1** Merger allowlist `return=` (ce PR) + redeploy www/Netlify
5. **P1** Retirer AdSense hors RGPD (`formation.html`)
6. **P1** Origin fail-closed + CSRF APIs cookie
7. **P2** Untrack `crypto_cache.db` ; Journal SSO least-privilege ; HMAC secrets

---

## Correctifs livrés dans ce PR

1. Rapport `docs/AUDIT-COMPLET-2026-09-19.md`
2. Script urgent `deploy/vps/FIX-RADAR-GIT-EXPOSE.sh`
3. Blocage `.git` dans `.htaccess` racine
4. Allowlist anti open-redirect dans `accompagnement-access.html`

---

*Audit code + live TORINVEST site + formation — 2026-09-19*
