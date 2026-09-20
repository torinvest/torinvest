# Atlas Styles de trading — La Forge

Ressource complémentaire Premium : découverte des autres lectures du marché
(chartisme, S/R, harmoniques, volume profile, footprint, carnet d’ordres, VWAP, Wyckoff, Elliott…).

## Accès

- URL membre : `https://app.torinvest-trading.com/styles-atlas.html`
- Gate : `initForgeGate({ requirePremium: true })`
- **Ne valide aucun module** (comme Atlas ICT)

## Fichiers

| Fichier | Rôle |
|---------|------|
| `deploy/vps/app-shells/styles-atlas.html` | Shell membre |
| `la-forge/js/forge-styles-atlas.js` | 12 fiches + SVG animés |
| `la-forge/css/forge-styles-atlas.css` | Styles isolés `#styles-atlas-root` |
| `la-forge/img/styles-atlas-icon.svg` | Icône dashboard |

## Déploiement VPS

```bash
REF=cursor/styles-trading-atlas-691a
# ou main après merge
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-all.sh" | bash
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-assets.sh" | bash
```

Vérif : ouvrir `/styles-atlas.html` connecté Premium → première fiche Supports & résistances.

## Contenu (12 fiches)

1. Supports & résistances  
2. Chartisme classique  
3. Chandeliers japonais  
4. Figures harmoniques  
5. Wyckoff accumulation  
6. Volume Profile  
7. Footprint & order flow  
8. Carnet d’ordres (DOM)  
9. VWAP  
10. Elliott (aperçu critique)  
11. Comparer les styles  
12. Limites & bonnes pratiques  
