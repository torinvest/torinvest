# Audit TORINVEST — 21 novembre 2026

Sondage **live** www + radar + app, comparé à `AUDIT-COMPLET-2026-09-19.md`.

## Résumé

| Sévérité | Count |
|----------|-------|
| Critiques ouvertes | **0** (2 critiques sep **corrigées**) |
| Haut | 1 |
| Moyen | 4 |
| Bas | 1+ |

## Critiques septembre — statut prod

| Item | Sep 19 | Nov 21 |
|------|--------|--------|
| `/media/*.mp4` public | 200 ~362 Mo | **404** |
| `radar/.git/HEAD` | 200 | **404** |
| `/course/videos/*` sans session | — | **302 → login** |
| `/course/*.html` sans session | — | **302 → login** |

## Contrôles live (extraits)

- `GET /api/books/ping` → `{ ready: true, pdfCount: 153 }`
- `POST /api/internal/formation-verify` sans clé → **401**
- `GET /api/me` → **401**
- Headers app : HSTS, CSP, XFO, nosniff
- Headers www : HSTS, XFO, nosniff — **pas de CSP**

## Findings ouverts

### H1 — `password_plain` CRM (Haut)
`api/admin-licence-lib.php` écrit encore le mot de passe formation en clair dans SQLite.

### M1 — Shells Premium sans auth serveur (Moyen)
`dashboard.html` / `books.html` / admin chart → **200** HTML ; gate client `forge-gate.js`. APIs OK (401).

### M2 — Dérive mots de passe (Moyen)
Stores séparés (membres SQLite vs `users.json`). Bridge #232 au login www seulement.

### M3 — Vidéo F5 (Moyen)
PR #234 ouverte ; deploy VPS manuel non confirmé dans cet audit.

### M4 — CSP manquante sur www (Moyen)

## Priorités

1. **P0** Stop `password_plain`
2. **P0** Merger + déployer F5
3. **P1** require-login serveur sur shells
4. **P1** Sync MDP change-password
5. **P1** CSP Netlify

## Architecture

- **www** Netlify — marketing + soft membres  
- **radar** PHP — CRM, member-auth, bridges  
- **app** Node/PM2 — La Forge Premium (`users.json`)
