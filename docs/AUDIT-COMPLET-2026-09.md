# Audit complet TORINVEST — septembre 2026

Périmètre : site public (`www.torinvest-trading.com`), CRM licences, API radar, formation La Forge (`app.torinvest-trading.com`), paiements Stripe/Brevo, ponts Atlas / Journal / Fondamental / TorPass.

---

## Synthèse

| Zone | Niveau | Verdict |
|------|--------|---------|
| Secrets dans le dépôt | OK | Pas de clés live commités ; `config.local.php` gitignoré |
| Stripe webhook | Bon | Signature HMAC + idempotence |
| CRM → Brevo | Corrigé (#101) | Envoi aussi à la création CRM manuelle |
| Formation — progression | Critique → corrigé | `totalSteps` client pouvait forger un unlock |
| API CORS Netlify preview | Haut → corrigé | `*.netlify.app` + credentials |
| Open redirect login Forge | Haut → corrigé | `?next=https://…` |
| Rate-limit PIN `dev-auth` | Haut → corrigé | Guard sans Hit |
| CSRF cookies `SameSite=None` | Haut | À traiter (Origin fail-closed) |
| Gates Premium client-only | Moyen | Shells HTML ; contenu sensible souvent API-gated |
| ICT Atlas contenu JS | Moyen | Contenu pédagogique en static |
| Abonnement après expiry | Moyen | Flag `subscribed` persisté sans re-check Worker |

---

## Surfaces cartographiées

1. **Marketing Netlify** — HTML racine, `la-forge/`, activation, TorPass, espace membre  
2. **API radar** (`api/*.php`) — CRM, Stripe, Brevo, AI Access, Atlas/Journal/Fondamental, membres, KRM  
3. **CRM** — `admin-licence/`  
4. **Formation VPS** — `deploy/vps/formation-server/` + `app-shells/`  
5. **Worker Cloudflare** — licences TOR-VIP / ACCOMPAGNEMENT (hors repo applicatif)

---

## Findings détaillés

### CRITIQUE (corrigé dans ce PR)

#### C1 — Unlock modules via `totalSteps` client
- **Fichiers :** `deploy/vps/formation-server/forge-progress-rules.js`, `routes-progress.js`
- **Problème :** Le client pouvait envoyer `totalSteps: 1` + `stepsDone: 1` → module `completed` en un PUT (malgré le plafond `MAX_STEPS_DELTA`).
- **Impact :** Contournement de la progression / lots de modules Premium.
- **Correctif :** Plancher `totalSteps >= 12` ; le client ne peut plus abaisser `totalSteps`.

### HAUT (corrigés)

#### H1 — CORS credentials sur tout `*.netlify.app`
- **Fichiers :** 13 endpoints `api/*.php`
- **Problème :** Toute preview Netlify recevait `Allow-Origin` + `Allow-Credentials`.
- **Impact :** Lecture de réponses authentifiées / surface CSRF élargie.
- **Correctif :** `$isNetlifyPreview = false` ; seuls les origins listés (prod + netlify app principal).

#### H2 — Open redirect post-login Forge
- **Fichier :** `la-forge/js/auth.js` (`forgeNextUrl`)
- **Problème :** `?next=https://evil.example` était accepté.
- **Correctif :** Uniquement chemins relatifs same-origin.

#### H3 — Rate-limit PIN `dev-auth` inopérant
- **Fichier :** `api/dev-auth.php`
- **Problème :** `torinvestRateLimitGuard` sans `torinvestRateLimitHit` en échec → brute-force illimité.
- **Correctif :** `Hit` sur PIN incorrect.

### HAUT (restants — backlog)

#### H4 — CSRF sur sessions cookie `SameSite=None`
- Cookies cross-site www ↔ radar sans contrôle Origin fail-closed sur POST.
- **Fix recommandé :** rejeter les mutations si `Origin`/`Referer` hors allowlist ; CSRF token pour CRM.

#### H5 — PIN / secrets HMAC couplés
- Sessions CRM / AI Access parfois signées avec le PIN.
- **Fix :** secrets HMAC dédiés longs, distincts des PIN.

#### H6 — Tokens / clés en query string
- `access_token`, `provision_key`, SSO parfois en `?…` → logs / Referer.
- **Fix :** cookies HttpOnly ou échange one-time POST.

### MOYEN

| ID | Sujet | Détail |
|----|--------|--------|
| M1 | Gates HTML client-only | `initForgeGate` sur shells ; `/course/*` + PDFs mieux protégés serveur |
| M2 | ICT Atlas JS public | Fiches en static — UI Premium only |
| M3 | `subscribed` sticky | Login TOR écrit `subscribed:true` sans revalidation expiry Worker |
| M4 | Calendar API | Auth sans Premium alors que shell exige Premium |
| M5 | Journal env auto-login | Mot de passe partagé si SSO échoue (si activé) |
| M6 | Admin links publics | Liens CRM/AI Access visibles — OK si PIN fort + rate-limit |
| M7 | RGPD AdSense | Scripts ads parfois hors consentement banner |
| M8 | XSS `innerHTML` | Erreurs API injectées sans escape sur certaines pages admin |
| M9 | KRM `list_my_requests` | Filtrage wallet sans preuve de possession |
| M10 | Soft-gate membres site | Contenu HTML toujours dans la page |

### BAS / INFO

- Libs PHP `*-lib.php` partiellement hors deny Apache  
- Invites Discord/Telegram dans config exemple  
- Domaines cohérents : `app.torinvest-trading.com` / `radar` / `www`  
- Webhook Stripe : signature + secret requis — bon  
- Hash mots de passe formation : `password_hash` — bon  
- Pas de secrets live dans git — bon  

---

## Flux métier vérifiés

| Flux | État |
|------|------|
| Stripe checkout → licence Worker → Brevo | OK (si `brevo_api_key`) |
| CRM « Générer licence » → Brevo | OK depuis #101 |
| CRM « Renvoyer email Brevo » | OK |
| Login Forge email + clé TOR-ACCOMPAGNEMENT | OK (binding email Worker) |
| Provision compte formation depuis CRM | OK si secrets VPS alignés |
| Gate Premium course / books / lives | Serveur OK sur routes sensibles |

---

## Correctifs livrés dans ce PR

1. Anti-forge `totalSteps` (progression formation)  
2. CORS Netlify preview désactivé (API)  
3. Open redirect login Forge  
4. Rate-limit Hit sur `dev-auth`  

## Déploiement requis

```bash
# Radar (API PHP)
for f in accompagnement-access.php admin-licence.php ai-access.php atlas-access.php \
  dev-auth.php discord-torpass.php fondamental-access.php journal-access.php \
  krm-service-payment.php license-provision.php member-auth.php solana-rpc.php torpass-client.php; do
  sudo cp "api/$f" "/var/www/torinvest/api/$f"
done

# VPS formation
cp deploy/vps/formation-server/forge-progress-rules.js /path/to/formation-server/
# + la-forge/js/auth.js (ou app-shells sync) puis pm2 restart
```

## Priorités suivantes (recommandées)

1. Origin fail-closed + CSRF CRM  
2. Re-validation Worker `subscribed` à chaque `/api/me`  
3. Servir ICT Atlas derrière auth (plus de JS public complet)  
4. Secrets HMAC séparés des PIN  
5. Audit RGPD AdSense / pages légales vs traitements réels  

---

*Audit code + correctifs ciblés — TORINVEST, 2026-09-05.*
