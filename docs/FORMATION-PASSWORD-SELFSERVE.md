# Login formation + mot de passe self-service (sept. 2026)

## Pourquoi la clé TOR « ne marchait pas »

Sur `app.torinvest-trading.com/api/login`, en cas d’échec le pont formation **déléguait** au login natif, qui répondait toujours :

`Identifiants incorrects`

Donc même avec une **vraie** clé `TOR-ACCOMPAGNEMENT` + bon email, le client voyait un refus générique (Worker KO, mauvais email, ou pont pas à jour).

**Correctif :** le pont ne délègue plus jamais ; messages d’erreur explicites (`email_mismatch`, `license_not_found`, etc.).

## Brevo après reset MDP (CRM)

`provision_formation` envoie maintenant un email Brevo dédié (« Ton mot de passe La Forge ») — plus besoin d’envoyer le MDP à la main.

## Self-service client

| URL | Usage |
|-----|--------|
| `/forgot-password.html` | Email Stripe + clé TOR → choisir un nouveau mot de passe |
| `/account-password.html` | Connecté → changer le mot de passe |

## Déploiement VPS

```bash
ssh ubuntu@164.132.46.191
curl -fsSL https://raw.githubusercontent.com/torinvest/torinvest/cursor/formation-password-selfserve-691a/deploy/vps/fix-formation-password-selfserve.sh | bash
```

CRM Netlify : merge + deploy de `admin-licence/index.html`.
