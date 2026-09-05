# Atlas ICT — La Forge

Ressource pédagogique complémentaire (12 fiches ICT) intégrée dans l’espace formation Premium.

## Où l’ouvrir

- URL membre : `https://app.torinvest-trading.com/ict-atlas.html`
- Nav : **Atlas ICT** (à côté de Atlas USA / Livres)
- Dashboard : carte **Atlas ICT**
- Formation : bouton **Atlas ICT**

## Accès

- **Login + Premium** via `initForgeGate({ requirePremium: true })` (même règle que Ressources lives / parcours).
- Accès direct URL : redirigé si non connecté / non Premium.
- **Ambiguïté signalée** : aucune règle existante ne mappe fiche ICT ↔ module débloqué.
  Les 12 fiches sont donc accessibles à tout Premium, sans verrou par module.
  Lire une fiche **ne valide pas** un module (pas d’appel progress/unlock).

## Fichiers

| Fichier | Rôle |
|---------|------|
| `deploy/vps/app-shells/ict-atlas.html` | Shell membre + markup |
| `la-forge/js/forge-ict-atlas.js` | 12 concepts + SVG + nav |
| `la-forge/css/forge-ict-atlas.css` | Styles isolés `#ict-atlas-root` |
| `la-forge/img/ict-atlas-icon.svg` | Icône |
| `la-forge/js/forge-brand.js` | Lien nav |
| `deploy/vps/app-shells/dashboard.html` | Carte dashboard |
| `deploy/vps/app-shells/course/index.html` | Lien formation |
| `deploy/vps/pull-forge-assets.sh` / `pull-forge-all.sh` | Déploiement |

## Deploy VPS

```bash
REF=cursor/ict-atlas-691a
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-all.sh" | bash
pm2 restart la-forge
```

## Vérifs locales effectuées

- 12 slugs présents
- Boot JS : titre, SVG, nav 12 liens, prev/next, hash direct
- Styles préfixés sous `#ict-atlas-root` (pas de fuite body/html)
- `node --check` OK
