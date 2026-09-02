# Images La Forge sur le VPS

Les fichiers PNG ne sont pas dans le dépôt GitHub public (taille + chemins app).

## Fichiers requis sur `app.torinvest-trading.com`

Copier dans `~/torinvest-formation/public/img/` :

| Fichier | Usage |
|---------|--------|
| `forge-anvil.png` | Favicon, dashboard, headers |
| `torinvest-logo-full.png` | Hero landing La Forge |
| `live-trading-banner.png` | Bandeau live (optionnel) |

Source : `la-forge/img/` sur ton PC ou backup VPS existant.

## Vérification

```bash
ls -la ~/torinvest-formation/public/img/
curl -sI https://app.torinvest-trading.com/img/forge-anvil.png | head -3
```

## Deploy assets JS/CSS (sans images)

```bash
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/main/deploy/vps/pull-forge-assets.sh" | bash
```

`pull-forge-assets.sh` tente aussi de tirer les PNG depuis GitHub ; si absents, il affiche un WARN sans échouer.
