# Fusion La Forge — 2026-06-11

## Non modifié (volontairement)
- `formation.html` — liste d'attente Netlify
- `formationprice.html` — conservée telle quelle
- `index.html` — paiement Stripe 349€/an

## Ajouté
- `la-forge/` — vitrine formation (modules, tarifs Robot/Signal, legal La Forge)

## Parcours client
1. Liste d'attente → `/formation` (inchangé)
2. Achat → `index.html` bloc 349€ → Stripe
3. Mail manuel de bienvenue → identifiants
4. Connexion → `app.torinvest-trading.com/login.html`

## Regénérer
```
cd torinvest-formation
node tools/export-static.mjs
node tools/fusion-la-forge.mjs ../torinvest-main
```
