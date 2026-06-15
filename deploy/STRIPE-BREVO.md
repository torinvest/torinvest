# Stripe → licence + Brevo (radar VPS)

Chaîne cible en production :

```
Paiement Stripe → webhook radar → licence Worker + SQLite → Brevo (liste + email)
Formulaire activation → metadata seulement (pas de nouvelle licence si déjà payé)
```

---

## 1. Déployer les fichiers PHP sur le VPS

Depuis le VPS (ou curl GitHub après push `main`) :

```bash
API_DIR="/var/www/torinvest/api"
BASE="https://raw.githubusercontent.com/torinvest/torinvest/main/api"
for f in admin-licence-lib.php brevo-lib.php stripe-lib.php stripe-webhook.php admin-licence.php license-provision.php; do
  sudo curl -fsSL -o "/tmp/$f" "$BASE/$f" && sudo mv "/tmp/$f" "$API_DIR/$f"
done
sudo chown www-data:www-data "$API_DIR"/*.php
sudo php -l "$API_DIR/stripe-webhook.php"
```

---

## 2. Compléter `config.local.php` sur le VPS

```php
// Stripe
'stripe_webhook_secret' => 'whsec_xxxxxxxx',

// Brevo (déjà ajouté chez toi)
'brevo_api_key' => 'xkeysib-...',
'brevo_list_accompagnement' => 9,
'brevo_list_vip' => 10,
'brevo_list_waitlist' => 5,
'brevo_sender_email' => 'contact@torinvest-trading.com',
'brevo_sender_name' => 'TORINVEST',

// Optionnel : templates Brevo transactionnels (sinon email HTML auto)
// 'brevo_template_vip' => 0,
// 'brevo_template_accompagnement' => 0,
```

---

## 3. Créer le webhook Stripe

1. [Stripe Dashboard](https://dashboard.stripe.com/webhooks) → **Ajouter un endpoint**
2. **URL** : `https://radar.torinvest-trading.com/api/stripe-webhook.php`
3. **Événements** :
   - `checkout.session.completed`
   - `invoice.paid` (renouvellements VIP / accompagnement)
   - `invoice.payment_failed` (alerte admin)
4. Copier le **Signing secret** (`whsec_…`) → `stripe_webhook_secret` sur le VPS

> Si tu as déjà un webhook Stripe ailleurs, tu peux **ajouter cette URL** en parallèle ou remplacer l’ancienne — pas besoin de tout refaire, seulement pointer vers le radar.

---

## 4. Payment Links — metadata recommandée

Sur chaque Payment Link Stripe, ajoute une metadata :

| Produit | Metadata |
|---------|----------|
| Robot Access 79€ | `torinvest_plan` = `vip` |
| Accompagnement 349€ | `torinvest_plan` = `accompagnement` |

Sans metadata, le radar reconnaît aussi :
- le slug du lien (`eVq14nclt5XV3ka0zFd7q02` VIP mensuel / `aFabJ10CLeurf2S827d7q01`)
- le montant (7900 / 34900 centimes EUR)

---

## 5. Sécuriser la prod (formulaires)

Quand le webhook Stripe fonctionne, désactive la provision sans paiement :

```php
'allow_form_provision' => false,
'require_webhook_provision' => true,  // Netlify seulement pour log/metadata
```

Les formulaires continueront d’être loggés via Netlify ; la **licence** ne sera créée qu’après paiement Stripe (ou manuellement dans le CRM).

---

## 6. Tester

### Stripe CLI (optionnel)

```bash
stripe listen --forward-to https://radar.torinvest-trading.com/api/stripe-webhook.php
stripe trigger checkout.session.completed
```

### Vérifier sur le VPS

```bash
sudo sqlite3 /var/www/torinvest/api/data/licence-crm.sqlite \
  "SELECT event_id, plan_type, email, license_code, provision_ok FROM stripe_webhook_events ORDER BY id DESC LIMIT 5;"
```

### CRM admin

`https://radar.torinvest-trading.com/admin-licence/` → onglet **Historique** : nouvelles licences VIP / ACCOMPAGNEMENT avec `stripe_ref`.

---

## Worker Cloudflare — renouvellements

Déploie aussi le Worker (`wrangler deploy`) pour activer `POST /license/extend` (prolongation VIP / accompagnement sur renouvellement Stripe).

---

## Payment Links — URL après paiement

Voir `deploy/PAYMENT-LINKS.md`.

---

| Payment Link | Plan | Liste Brevo | Jours licence |
|--------------|------|-------------|---------------|
| `eVq14nclt5XV3ka0zFd7q02` | VIP (79€/mois) | #10 | 30 |
| `aFabJ10CLeurf2S827d7q01` | ACCOMPAGNEMENT | #9 | 365 |

---

## Dépannage

| Symptôme | Cause probable |
|----------|----------------|
| HTTP 400 `signature_stripe_incorrecte` | Mauvais `whsec_` ou test sans header Stripe |
| `produit_stripe_inconnu` | Metadata + slug + montant non reconnus → ajouter `plink_` ou `price_` dans config |
| `email_stripe_manquant` | Client a payé sans email → activer collecte email sur Payment Link |
| Licence OK, pas d’email Brevo | Vérifier `brevo_api_key`, expéditeur validé dans Brevo |
| Contact Brevo OK, email KO | Créer un template transactionnel ou laisser `brevo_template_*` à `0` |
