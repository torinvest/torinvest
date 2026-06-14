# Automatisation formulaires Netlify → licences TORINVEST

## Principe

1. L’utilisateur envoie le formulaire Netlify (comme aujourd’hui).
2. **Netlify Function** `submission-created` appelle automatiquement le radar.
3. Le radar génère la licence, **loggue** la soumission en SQLite et envoie une **alerte Discord** (optionnel).
4. Le navigateur peut toujours afficher la licence immédiatement (double sécurité).

Plus besoin de surveiller manuellement le dashboard Netlify Forms.

---

## 1. Générer un secret partagé

Sur ton PC ou le VPS :

```bash
openssl rand -hex 32
```

Copie la valeur (ex. `a1b2c3…`).

---

## 2. Configurer le VPS radar (`config.local.php`)

Ajoute ou mets à jour :

```php
'provision_webhook_secret' => 'COLLE_TON_SECRET_ICI',
'allow_form_provision' => true,
// Optionnel : désactive la provision directe navigateur (webhook seulement)
// 'require_webhook_provision' => false,

// Alertes admin Discord (webhook serveur privé admin)
'provision_notify_discord_webhook' => 'https://discord.com/api/webhooks/…',
```

Puis redéploie les fichiers PHP (`pull-api.sh` ou curl GitHub).

---

## 3. Variables d’environnement Netlify

Site Netlify → **Site configuration** → **Environment variables** :

| Variable | Valeur |
|----------|--------|
| `PROVISION_WEBHOOK_SECRET` | **Même secret** que `provision_webhook_secret` radar |
| `PROVISION_RADAR_URL` | `https://radar.torinvest-trading.com/api/license-provision.php` (optionnel) |

---

## 4. Déployer le site (Netlify)

Push `main` sur GitHub → Netlify rebuild.

Le fichier `netlify/functions/submission-created.js` est déclenché **automatiquement** à chaque soumission de formulaire.

---

## 5. Vérifier

1. Envoie un formulaire test sur `/activation-accompagnement.html`
2. Vérifie :
   - licence affichée à l’écran
   - entrée dans **CRM → Surveillance formulaires**
   - message Discord admin (si webhook configuré)
3. Logs Netlify : **Functions** → `submission-created`

Test manuel webhook (VPS) :

```bash
curl -s -X POST https://radar.torinvest-trading.com/api/license-provision.php \
  -H "Content-Type: application/json" \
  -H "X-Provision-Key: TON_SECRET" \
  -d '{"form_name":"activation-accompagnement-torinvest","data":{"email":"test2@example.com","name":"Test","form-name":"activation-accompagnement-torinvest"}}'
```

---

## Formulaires surveillés

| `form_name` | Produit | Licence |
|-------------|---------|---------|
| `activation-torinvest` | Robot Access 79€ | `TOR-VIP-…` |
| `activation-accompagnement-torinvest` | Accompagnement 349€ | `TOR-ACCOMPAGNEMENT-…` |

Les autres formulaires Netlify (waitlist, formation…) sont ignorés par la function.

---

## Fallback : webhook Netlify UI (sans Function)

Si la Function ne tourne pas, tu peux ajouter un **Outgoing webhook** dans Netlify :

**Forms → Form notifications → Outgoing webhook**

URL :

```
https://radar.torinvest-trading.com/api/license-provision.php?provision_key=TON_SECRET
```

Le radar accepte le secret en query string ou header `X-Provision-Key`.
