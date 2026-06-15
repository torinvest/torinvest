# Automatisation formulaires Netlify → radar TORINVEST

## Principe (production)

1. **Paiement Stripe** → webhook radar → licence Worker + email Brevo.
2. **Formulaire activation** → metadata profil seulement (Discord, niveau) — **pas** de nouvelle licence.
3. **Netlify Function** `submission-created` appelle le radar à chaque soumission (waitlist + profils).

---

## 1. Secret partagé Netlify ↔ radar

```bash
openssl rand -hex 32
```

---

## 2. VPS radar (`config.local.php`)

```php
'provision_webhook_secret' => 'COLLE_TON_SECRET_ICI',
'allow_form_provision' => false,
'require_webhook_provision' => true,
'stripe_webhook_secret' => 'whsec_…',
// Alertes admin Discord (optionnel)
'provision_notify_discord_webhook' => 'https://discord.com/api/webhooks/…',
```

Puis : `bash deploy/vps/pull-api.sh` (ou curl GitHub).

---

## 3. Variables Netlify

| Variable | Valeur |
|----------|--------|
| `PROVISION_WEBHOOK_SECRET` | Même secret que `provision_webhook_secret` |
| `PROVISION_RADAR_URL` | `https://radar.torinvest-trading.com/api/license-provision.php` (optionnel) |

---

## 4. Déployer

Push `main` → Netlify rebuild. La Function `netlify/functions/submission-created.js` tourne à chaque soumission.

---

## 5. Vérifier

1. Paiement test Stripe → licence dans CRM + email Brevo.
2. Formulaire `/activation-accompagnement.html` → entrée **Surveillance Netlify** (metadata), pas de nouvelle clé.
3. Waitlist → contact Brevo liste #5.

Test webhook radar :

```bash
curl -s -X POST https://radar.torinvest-trading.com/api/license-provision.php \
  -H "Content-Type: application/json" \
  -H "X-Provision-Key: TON_SECRET" \
  -d '{"form_name":"activation-accompagnement-torinvest","data":{"email":"test@example.com","name":"Test","form-name":"activation-accompagnement-torinvest"}}'
```

Réponse attendue : `metadata_only` ou log profil — **pas** de nouvelle licence si `allow_form_provision` est `false`.

---

## Formulaires surveillés

| `form_name` | Rôle |
|-------------|------|
| `activation-torinvest` | Profil VIP (licence via Stripe) |
| `activation-accompagnement-torinvest` | Profil accompagnement (licence via Stripe) |
| `liste-attente-torinvest` | Brevo liste #5 + email bienvenue |

---

## Fallback sans Function

Netlify → **Forms** → **Outgoing webhook** :

```
https://radar.torinvest-trading.com/api/license-provision.php?provision_key=TON_SECRET
```

Secret aussi accepté en header `X-Provision-Key`.
