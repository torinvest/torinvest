# Audit — déblocage par lots de 3 (13 oct 2026)

## Symptôme (prod)
- Index formation : **0 / F1 / F2** en badge **Validé**, boutons **Revoir**
- Progression : `3 / 37 modules validés (8%)`
- Teaser : `34 module(s) à venir — masqués jusqu’au déblocage du lot. Validez le lot actuel pour ouvrir les 3 modules suivants.`
- Les modules du lot 2 (**F3, F4, F5**) n’apparaissent pas

## Verdict
Deux couches distinctes :

### 1) Unlock client inactif sur l’index (cause principale)
Le texte du teaser est le **fallback hardcodé** de `course-index.js` quand  
`typeof getNextUnlockHint !== "function"`.

Or `getNextUnlockHint` n’est exporté que par `forge-unlock.js`.  
Donc sur la page vue par l’élève, **l’API unlock n’est pas montée** (script absent / index HTML VPS pas à jour / early-return).

Dans ce cas `course-index.js` utilise le fallback :

```js
idx >= 0 && idx < 3   // toujours lot 1 seulement
```

→ même si les 3 premiers sont `completed: true`, **F3+ restent masqués**.

Fichiers live OK séparément (`/js/forge-unlock.js` sert bien `isModuleUnlocked`),  
mais l’index authentifié doit inclure :

```html
<script src="/js/forge-unlock.js"></script>
```

avant `course-index.js` (voir `deploy/vps/app-shells/course/index.html`).

### 2) « Validé » sans questionnaire — pas un bug d’unlock
Règles actuelles (`progress.js` / `forge-progress-rules.js`) :

- `quizTotal <= 0` ⇒ quiz considéré OK
- `stepsDone >= totalSteps` (+ pratique si présente) ⇒ `completed: true`

Donc un élève qui parcourt les sections **sans lancer le quiz** peut avoir le badge **Validé**.  
Ce n’est **pas** ce qui bloque le lot 2 : avec unlock actif, le lot 2 s’ouvrirait quand même.

## Comportement attendu (spec)
1. À l’abonnement : lot 1 ouvert (`intro`, `f01`, `f02`)
2. Quand les 3 du lot sont `completed` : lot 2 ouvert (`f03`, `f04`, `f05`)
3. Idem lots suivants
4. Serveur (`forge-unlock-server.js` + middleware) applique la même règle (fail-closed)

## Correctifs
1. Hardening `forge-unlock.js` : toujours exporter l’API complète (pas d’early-return silencieux)
2. `course-index.js` : message explicite si unlock absent + garde-fou lot validé / pas d’ouverture
3. Cache-bust scripts sur `app-shells/course/index.html`
4. Redeploy VPS : `apply-unlock-now.sh` (réécrit `public/course/index.html` + JS)

## VPS — appliquer
```bash
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/apply-unlock-now.sh" | bash -s -- ~/torinvest-formation
pm2 restart la-forge
```

Puis Ctrl+Shift+R sur `/course/index.html`.

Vérifs attendues dans la page (console) :
- `typeof isModuleUnlocked` → `"function"`
- `typeof getNextUnlockHint` → `"function"`
- Si lot 1 validé : `getUnlockedModuleIds().length >= 6` et F3 visible
