# Templates email Brevo TORINVEST

Fichiers HTML prêts à coller dans Brevo :

| Fichier | Produit | Objet suggéré |
|---------|---------|---------------|
| `template-vip.html` | Robot Access 79€ | `TORINVEST — Votre clé Robot Access VIP` |
| `template-accompagnement.html` | Accompagnement 349€ | `TORINVEST — Votre clé Accompagnement Trading` |

Design : fond noir `#030303`, or `#ffb400`, logo `forge-logo.png`.

---

## 1. Créer le template VIP dans Brevo

1. [app.brevo.com](https://app.brevo.com) → **Campagnes** → **Transactionnel** → **Modèles**
2. **Créer un modèle** → éditeur **HTML** (ou « Code your own »)
3. Ouvre `template-vip.html` sur ton PC → **Ctrl+A** → **Ctrl+C**
4. Colle dans Brevo → **Enregistrer**
5. Objet : `TORINVEST — Votre clé Robot Access VIP`
6. Note l’**ID** du modèle (ex. `15`)

## 2. Créer le template Accompagnement

Même procédure avec `template-accompagnement.html`  
Objet : `TORINVEST — Votre clé Accompagnement Trading`

---

## 3. Bandeau La Forge (optionnel)

Pour utiliser ton visuel « LA FORGE » en header :

1. Upload l’image sur Netlify (ex. `/assets/email-la-forge-banner.png`)
2. Dans `template-accompagnement.html`, remplace l’URL du logo par :
   `https://www.torinvest-trading.com/assets/email-la-forge-banner.png`

---

## 4. Config VPS

```bash
sudo nano /var/www/torinvest/api/config.local.php
```

```php
'brevo_template_vip' => 15,              // ID Brevo template VIP
'brevo_template_accompagnement' => 16,     // ID Brevo template Accompagnement
```

`0` = email HTML intégré radar (repli automatique).

---

## 5. Variables Brevo utilisées

| Variable | Description |
|----------|-------------|
| `{{ params.PRENOM }}` | Prénom |
| `{{ params.LICENCE }}` | Clé TOR-VIP ou TOR-ACCOMPAGNEMENT |
| `{{ params.ACTIVATION_CODE }}` | Code MT5 (VIP) |
| `{{ params.ACTIVATION_URL }}` | Formulaire profil |
| `{{ params.FORMATION_URL }}` | Login formation |
| `{{ params.TELEGRAM_URL }}` | Telegram |
| `{{ params.DISCORD_URL }}` | Discord |

---

## 6. Test

CRM → **Stripe / Brevo** → **Renvoyer email licence**  
ou paiement test Stripe.
