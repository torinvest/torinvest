# Audit TorInvest — Journal complet + site (2026-10-06)

**Branche :** `cursor/audit-journal-complet-691a`  
**Méthode :** curl `--resolve` (DNS CF `1.1.1.1` → `164.132.46.191`), lecture code `main` + historique PR #180–#189, comparaison ping live vs ping repo.

---

## 1. Executive verdict

**Le clic trade → détail dans le Trading Journal embarqué est toujours cassé pour l’utilisateur.**  
Ce n’est pas un mystère métaphysique : c’est un **proxy iframe mal déployé**, aggravé par **11 hotfixes qui se marchent dessus** et un **vérificateur de déploiement trop faible**.

### Cause honnête (aujourd’hui)

| Couche | Preuve live | Verdict |
|--------|-------------|---------|
| Prod Node | `GET /api/journal-bridge/ping` → `version:13`, `clickEverywhere:true`, **sans** `cspStrip` / `tradeRowObserver`, `scriptSrcAttr:"unsafe-inline"` | = commit **#188** (`dcc5dfa`), **pas** nuclear **#189** (`f437c3e`) |
| CSP `/journal-embed/` | Header encore présent, policy « radar + `script-src-attr 'unsafe-inline'` » | Exactement `applyJournalEmbedCsp` de #188 (SET CSP), pas le strip #189 |
| Note screens ping | `"v13: top/parent.location rewrite + radar assets CSP — …"` | Fingerprint #188 |
| Repo / `main` | `cspStrip:true`, `tradeRowObserver:true`, `scriptSrcAttr:"none-stripped"` | Nuclear **mergé** (PR #189) mais **jamais appliqué sur le VPS** (ou écrasé) |
| Hotfix verify | `HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh` exigeait `clickEverywhere` + `version:13` **sans** exiger `cspStrip` | Un deploy « OK » pouvait laisser la prod sur #188 |

**Pourquoi les fixes précédents n’ont pas satisfait l’utilisateur :** mauvaise cible (screens) → bonne cible CSP mal patchée (typo → 502) → CSP assouplie mais nav/iframe encore fragile → nuclear écrit et mergé → **pas live**. Chaque tour a coûté de la confiance sans changer l’octet exécuté.

**Gap forensique assumé :** sans session Premium cloud, on n’a **jamais** vu le HTML authentifié TJ (`openTrade` réel). Les fixtures et le code radar login prouvent le contrat `onclick`, pas le DOM live membre.

---

## 2. Live state snapshot (2026-10-06 ~17:36 UTC)

Hôtes : `app.torinvest-trading.com` / `radar.torinvest-trading.com` → `164.132.46.191` (Cloudflare DNS).

### Pings

```json
// GET /api/journal-bridge/ping
{
  "ok": true, "mounted": true, "app": "trading_journal_pro",
  "upstream": "https://radar.torinvest-trading.com/trading_journal.php",
  "sso": true, "autoLoginEnv": false,
  "tradeScreensInject": false, "injectDisabled": true, "injectHardOff": true,
  "clickRestore": true, "cspClickFix": true, "hrefClickFix": true,
  "clickEverywhere": true,
  "scriptSrcAttr": "unsafe-inline",
  "version": 13
}
// ABSENT live: cspStrip, tradeRowObserver
```

```json
// GET /api/journal-trade-screens/ping
{
  "ok": true, "ready": true, "version": 13,
  "clickEverywhere": true, "injectHardOff": true, "inject": "off",
  "note": "v13: top/parent.location rewrite + radar assets CSP — list+calendar trade click"
}
// ABSENT live: cspStrip, tradeRowObserver
// Repo note: "v13: CSP stripped + MutationObserver…"
```

### CSP (lignes critiques)

| URL | CSP |
|-----|-----|
| `/journal.html` | Helmet app : `script-src-attr 'unsafe-inline'` (générique) |
| `/journal-embed/` (403 sans session) | **Bridge #188** : `default-src 'self' https://radar…`; `script-src-attr 'unsafe-inline'` — **CSP présente** |
| `/api/journal-bridge/ping` | Helmet app (pas strip) |
| Radar `/trading_journal.php` | **Aucune CSP** |

### Autres probes

| Path | Résultat |
|------|----------|
| `/login.html`, `/journal.html`, `/calendar.html`, `/dashboard.html` | 200 |
| `/api/me` | 401 `{"error":"Non authentifié"}` (normal) |
| `/api/ping` | **404** HTML landing (endpoint mort) |
| `/api/journal-bridge/ping`, `/api/journal-trade-screens/ping` | 200 JSON |
| `/trading_journal.php` (app) | **302** → `/journal-embed/` (safety net OK ; pas un 404) |
| `/journal-embed/` | **403** « Session La Forge Premium requise » |
| Radar TJ | 200 page login PHP, Set-Cookie `PHPSESSID`, **pas de CSP** |
| Live `forge-journal.js?v=14` | Iframe-only, inject screens hard-off — aligné shell |
| Live `journal.html` | iframe `#journal-frame` **sans** `sandbox` |

### Radar vs forge embed

- **Radar :** PHP natif, cookies session, **zéro CSP** → `onclick` inline libre.
- **Forge embed :** same-origin proxy + rewrite + shim + **CSP Helmet/bridge** → surface de panne multi-couches.

---

## 3. Journal root-cause map

### Chemin complet

```
journal.html
  → forge-journal.js (Premium gate → iframe src=/journal-embed/)
    → routes-journal-bridge.js (requirePremium + SSO HMAC + proxy)
      → radar /trading_journal.php
        → rewriteJournalHtml (assets + trading_journal.php → /journal-embed/)
        → injectProxyShim (location/fetch/XHR + fallback clic)
```

**Confusion calendrier :** `app/calendar.html` = calendrier **formation** (modules). Le calendrier **trades** est **dans** TJ (même iframe) — même bug clic.

### Historique des fixes (théorie / deploy / suffisance)

| Fix | Théorie | Live / deploy | Suffisant ? |
|-----|---------|---------------|-------------|
| Screens inject bloque clics | **Partiellement vraie** un temps | Inject OFF live (`inject:"off"`) | **Insuffisant** seul — clic encore mort après OFF |
| `isAddTradePage` false positive | **Vraie** (fixtures) | Contournée par SAFE MODE / hard-off | **Insuffisant** |
| SAFE MODE / inject off | Correcte pour screens | Live `injectHardOff:true` | **Insuffisant** (cause screens ≠ cause finale) |
| CSP `script-src-attr 'none'` | **Confirmée** (Helmet vs radar) | Live a `unsafe-inline` sur embed | **Nécessaire mais pas suffisant** |
| 502 typo CSP hotfix | **Confirmée** | Restauré (#185) | Régression ops, pas fix clic |
| `location.href` rewrite | **Plausible confirmée** (app n’a pas le PHP) | #188 live : rewrite + redirect `/trading_journal.php` | **Insuffisant** seul |
| `top`/`parent.location` | **Likely** (break-out iframe → 404/redirect confus) | #188 live a `keepInFrame` | Encore des clics morts rapportés |
| CSP strip + MutationObserver (#189) | **Bonne archi A** | **Code sur main, PAS live** | Jamais testé en prod utilisateur |
| Overlay shell / sandbox / pointer-events parent | Peu probable | iframe sans sandbox ; chrome masqué en `journal-app-open` | **Ruled out** comme cause principale |
| SSO → UI login seule | Possible si secret/session KO | `sso:true`, `autoLoginEnv:false` ; HTML auth **non vu** | **Likely residual** si clic « ne fait rien » = toujours login |
| `rewriteJournalHtml` corrompt JS | Testé sur fixtures | Remplace `'trading_journal.php` → `'/journal-embed/` correctement pour `openTrade` typique | **Ruled out** pour le pattern standard ; risque résiduel sur strings exotiques |
| Proxy ignore subpaths assets | **Confirmé code** | `buildUpstreamUrl` = toujours `trading_journal.php` + query | Mitigé par `absolutizeRadarAssets` (slash paths) ; **relatifs sans `/` encore risqués** |
| Helmet vs bridge race | Mitigé si strip monkey-patch | Live : bridge SET gagne (policy radar) | Après strip : nginx ne réécrit pas cette policy (preuve : policy = Node) |
| nginx strip/overwrite CSP | Non pour embed | Policy journal-spécifique = Node | **Ruled out** comme source de la CSP embed |

### Bloqueurs restants (avec évidence)

1. **CONFIRMED — nuclear undeployed** : ping + CSP + note screens = #188.
2. **CONFIRMED — hotfix verify gap** : succès possible sans `cspStrip`.
3. **CONFIRMED — hotfix sprawl** : 6 scripts CLICK* sans markers nuclear écraseraient le bridge si relancés.
4. **LIKELY — nav iframe / openTrade** encore fragile sous #188 sans observer.
5. **LIKELY / GAP — SSO** : si embed montre login TJ, tout « clic » est vain.
6. **UNKNOWN — contrat DOM auth** : `openTrade` onclick jamais vu en session réelle.

---

## 4. Recommended single fix path + command

### Architecture choisie : **A** (proxy propre) + **B** (secours UX)

**A (décisif) :** CSP **absente** sur `/journal-embed/*` (comme radar) + nav forcée dans iframe + assets radar absolutisés (slash **et** relatifs) + fallback clic MutationObserver + **zéro** inject screens.  
**B (filet)** : bouton « Ouvrir hors iframe (SSO radar) » — fiabilité produit pendant que A est validé.

**Ne pas** empiler un 12ᵉ hotfix heuristique sans preuve DOM auth.

### UNE commande VPS (après merge / push de cette branche)

```bash
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/audit-journal-complet-691a/deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh" | bash
```

### Succès **si et seulement si**

```json
"version": 14,
"clickEverywhere": true,
"cspStrip": true,
"tradeRowObserver": true,
"scriptSrcAttr": "none-stripped"
```

Et :

```bash
# CSP doit ÊTRE ABSENTE (ou ne plus contenir de policy bridge)
curl -sI https://app.torinvest-trading.com/journal-embed/ | grep -i content-security-policy
# attendu: aucune ligne (ou pas la policy radar/embed)
```

Puis hard refresh `journal.html` → clic ligne **ou** case calendrier TJ → détail.

Si ping OK et clic encore mort → forensique session Premium (View Source iframe, console) ; activer le bouton B.

### Anciens hotfixes

**NE PAS** relancer : `HOTFIX-JOURNAL-CLICK-DETAIL*.sh`, `*-NUKE.sh`, `*-RESTORE.sh`, `*-CSP.sh`, `*-HREF.sh` — ils **régressent** vers un bridge sans strip.

---

## 5. Other site findings

| Sev | Finding |
|-----|---------|
| **P0** | Journal clic détail — §1–4 |
| **P0** | 11× `HOTFIX-JOURNAL-*` — risque d’écraser le nuclear |
| **P1** | Incident 502 déjà prouvé (typo `script-src-attr`) — tout patch `server.js` doit `node --check` |
| **P1** | Gap HTML TJ authentifié (agent cloud sans cookie Premium) |
| **P1** | `/api/ping` 404 — healthchecks/docs trompeurs |
| **P2** | Confusion `calendar.html` formation vs calendrier TJ |
| **P2** | Screens feature OFF — ne réactiver qu’après clic stable + flag env |
| **P2** | Secrets : pas de secret production hardcodé trouvé ; exemples/placeholders + env refs OK (ne pas committer de valeurs) |
| **P2** | SSO HMAC journal : secret env partagé Fondamental — OK si rotaté ; `autoLoginEnv:false` = pas de fallback mdp en clair live |

Auth gates : `/journal-embed/` 403, `/api/me` 401, `/course/index.html` 302 login — cohérents.  
Nav dashboard → `/journal.html`, `/calendar.html` : liens présents (200).

---

## 6. Files changed / PR

- `deploy/vps/AUDIT-JOURNAL-COMPLET.md` — cet audit
- `deploy/vps/formation-server/routes-journal-bridge.js` — **v14** : strip CSP, assets relatifs, SSO deep-link API, ping strict
- `deploy/vps/formation-server/routes-journal-trade-screens.js` — ping v14 aligné
- `deploy/vps/HOTFIX-JOURNAL-CLICK-EVERYWHERE.sh` — branche audit, verify **exige** `cspStrip` + `version:14` + absence CSP
- `deploy/vps/HOTFIX-JOURNAL-CLICK-*.sh` (anciens) — bannière DEPRECATED
- `la-forge/js/forge-journal.js` + `deploy/vps/app-shells/journal.html` — bouton secours B
- `deploy/vps/tests/test-journal-click-everywhere.js` — guards v14

PR draft : base `main`, head `cursor/audit-journal-complet-691a`.

---

## 7. Conclusion

Le produit n’est pas « maudit » : **le code qui devait réparer le clic n’est pas celui qui tourne**.  
Corriger ça = **une commande + ping v14 strict**, pas un 15ᵉ rewrite d’hypothèse.  
Si après v14 live le clic échoue encore, la prochaine preuve obligatoire est le **HTML authentifié** (ou le bouton B radar SSO), pas un nouveau patch CSP.
