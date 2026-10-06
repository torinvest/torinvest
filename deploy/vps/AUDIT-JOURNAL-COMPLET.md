# Audit TorInvest — Journal & site (2026-10-06)

## 1. Verdict exécutif

**Le site membre (login, dashboard, journal shell, calendrier formation) répond en 200.**  
**Le clic trade → détail lecture dans Trading Journal Pro est toujours cassé côté expérience utilisateur**, malgré une série de hotfixes.

Cause structurelle : le journal n’est pas natif sur `app.*` — c’est un **proxy iframe** vers `radar…/trading_journal.php`. Chaque couche (Helmet CSP, rewrite HTML, inject screens, navigation `location` / `top.location`) peut casser les clics. Les correctifs ont souvent :

1. **visé la mauvaise cause** (inject screens) pendant longtemps ;
2. **été mal déployés** (mauvais chemin de fichier → ping ancien) ;
3. **été incomplets** (CSP assouplie mais pas retirée ; `location` patché mais pas `top/parent` + pas de fallback clic) ;
4. **cassé la prod** une fois (typo CSP → SyntaxError → **502**).

**État live au moment de l’audit (prouvé par curl) :**

| Signal | Valeur live | Interprétation |
|--------|-------------|----------------|
| `journal-bridge` ping | `version:13`, `clickEverywhere:true`, **pas** `cspStrip` / `tradeRowObserver` | Partial v13 déployée — **nuclear non déployé** |
| CSP `/journal-embed/` | encore présente (`script-src-attr 'unsafe-inline'` + radar) | Confirmé : strip CSP absent |
| `/trading_journal.php` | **302 → `/journal-embed/`** | Redirect safety net OK |
| Radar TJ | **aucune CSP** | Comportement natif ≠ forge embed |
| Screens inject | `inject:"off"` + stub JS | Plus la cause principale |

**Action décisive :** déployer la branche `cursor/journal-click-everywhere-691a` (nuclear : CSP strip + observer lignes + keep-in-frame), **une seule commande**, vérifier ping `cspStrip:true` + `tradeRowObserver:true`, puis hard refresh.

---

## 2. Architecture journal (chemin réel)

```
journal.html (app)
  → forge-journal.js ouvre iframe src=/journal-embed/
    → routes-journal-bridge.js (Express, Premium + SSO)
      → https://radar.torinvest-trading.com/trading_journal.php
        → HTML réécrit + shim JS injecté
```

- **Forge `calendar.html`** = calendrier d’apprentissage modules — **pas** le calendrier des trades.
- Le calendrier trades est **dans** TJ Pro (même iframe) → même panne de clic.

---

## 3. Historique des fixes (carte causes)

| # | Hypothèse | Statut | Commentaire |
|---|-----------|--------|-------------|
| Screens mount sur liste / capture `stopPropagation` | Partielle / dépassée | A bloqué des clics un temps ; SAFE MODE + hard-off ensuite |
| `isAddTradePage` trop large | Insuffisant | False positives réels, mais pas le bloqueur final |
| Inject OFF (#183) | **Jamais live** au moment du diagnostic | Ping restait v9 |
| CSP `script-src-attr 'none'` | **Confirmé** | Radar n’a pas de CSP ; forge oui → `onclick=openTrade` tué |
| Hotfix CSP typo `server.js` | **Confirmé** | → Node down → nginx **502** |
| `location.href` → `trading_journal.php` 404 | **Confirmé plausible** | app n’héberge pas le PHP ; v12 patch href |
| `top`/`parent.location` break-out | **Likely** | Partial v13 ; nuclear ajoute keep-in-frame |
| CSP strip + MutationObserver | **Code prêt, pas live** | Ping sans `cspStrip` / `tradeRowObserver` |
| Overlay shell forge | **Peu probable** | `journal.html` / `forge-journal.js` propres |
| HTML TJ authentifié inspecté | **GAP** | Sans session Premium on ne voit que login / 403 embed |

---

## 4. Snapshot live (extrait)

```
GET /api/journal-bridge/ping
  version:13 clickEverywhere:true hrefClickFix:true
  (manque cspStrip, tradeRowObserver)

GET /journal-embed/ (sans session) → 403
  Content-Security-Policy: … script-src-attr 'unsafe-inline' … (CSP ENCORE LÀ)

GET /trading_journal.php → 302 Location: /journal-embed/

Radar /trading_journal.php → 200, pas de CSP
```

Pages membres OK : `/`, `/login.html`, `/journal.html`, `/calendar.html`, `/dashboard.html`, atlas, fondamental, books, resources, coaching-fiches, swing-analyses.

Autres : `/api/me` → 401 sans cookie (normal) ; `/api/ping` → 404 (endpoint absent / legacy).

---

## 5. Recommandation unique (P0)

### Déployer le nuclear clickEverywhere

```bash
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/journal-click-everywhere-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh" | bash
```

**Succès si et seulement si** le ping contient :

```json
"version":13,
"clickEverywhere":true,
"cspStrip":true,
"tradeRowObserver":true
```

Puis : Ctrl+Shift+R sur `https://app.torinvest-trading.com/journal.html` → clic ligne trade **ou** jour calendrier TJ → détail lecture.

### Si ping OK et clic encore mort

Alors la cause est **dans TJ / SSO / HTML authentifié** (pas dans les hypothèses CSP/inject). Prochaine étape forensique :

1. Session Premium → View Source iframe `/journal-embed/`
2. Chercher `openTrade`, `onclick`, scripts externes, erreurs console
3. Comparer avec ouverture directe radar (SSO) comme filet de secours UX

### Architecture cible (après stabilisation)

- **A (préférée)** : proxy propre = **pas de CSP** sur embed (comme radar) + nav forcée dans iframe + assets radar absolutisés + **zéro** inject screens par défaut.
- **B (secours produit)** : bouton « Ouvrir le journal (plein écran / radar SSO) » si l’iframe reste fragile.
- **Éviter** : empiler de nouveaux `HOTFIX-JOURNAL-*` sans retirer les anciens (11 scripts aujourd’hui → chaos ops).

---

## 6. Autres constats site (hors clic)

| Sévérité | Finding |
|----------|---------|
| **P0** | Journal clic détail — voir §1–5 |
| **P0** | Sprawl hotfixes journal (11 scripts) — risque de redéployer une vieille version et d’écraser le nuclear |
| **P1** | Incident 502 déjà survenu via patch `server.js` — tout hotfix doit `node --check` avant `pm2 restart` (fait sur restore) |
| **P1** | Gap forensique : pas d’accès HTML TJ authentifié depuis l’agent cloud |
| **P2** | `/api/ping` 404 — nettoyer docs / healthchecks |
| **P2** | `calendar.html` (formation) vs calendrier TJ — confusion UX possible pour le support |
| **P2** | Screens feature volontairement OFF — à réactiver seulement après clic stable, derrière flag env |

---

## 7. Sécurité (note courte)

- Bridge journal : Premium + SSO HMAC (secret env) — cohérent.
- Embed 403 sans session — OK.
- CSP strip sur embed = alignement radar (TJ inline onclick) — acceptable pour cette app legacy PHP ; ne pas stripper CSP sur tout `app.*`.
- Ne pas committer de secrets ; les hotfixes raw.githubusercontent sont publics (OK pour scripts).

---

## 8. Fichiers / branches utiles

- Fix nuclear : `cursor/journal-click-everywhere-691a`  
  - `deploy/vps/formation-server/routes-journal-bridge.js`  
  - `deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh`
- Cet audit : `deploy/vps/AUDIT-JOURNAL-COMPLET.md` (branche audit)

---

## 9. Conclusion honnête

Ce n’est **pas** « impossible à régler » : c’est un **proxy + CSP + navigation** mal maîtrisé, aggravé par des déploiements partiels et des hotfixes qui se marchent dessus.  
Aujourd’hui le code nuclear est sur GitHub mais **pas entièrement en prod** (CSP encore servie, pas de `cspStrip` au ping).  
**Une commande VPS + vérification ping stricte** est le prochain pas obligatoire — sans ça, aucun nouveau fix code ne changera l’expérience utilisateur.
