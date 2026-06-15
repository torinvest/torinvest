# Payment Links Stripe — URLs de succès TORINVEST

## Liens d'achat (site)

| Produit | Payment Link |
|---------|----------------|
| **Robot Access 79€/mois** | `https://buy.stripe.com/eVq14nclt5XV3ka0zFd7q02` |
| **Accompagnement 349€/an** | `https://buy.stripe.com/aFabJ10CLeurf2S827d7q01` |

Configure ces URLs dans **Stripe → Payment Links → Modifier** (redirection après paiement).

| Produit | URL après paiement |
|---------|-------------------|
| **Robot Access 79€** | `https://www.torinvest-trading.com/payment-success.html?plan=vip` |
| **Accompagnement 349€/an** | `https://www.torinvest-trading.com/payment-success.html?plan=accompagnement` |

## Metadata recommandée

| Clé | VIP | Accompagnement |
|-----|-----|----------------|
| `torinvest_plan` | `vip` | `accompagnement` |

## Webhooks radar

Événements à activer sur `torinvest-radar` :

- `checkout.session.completed`
- `invoice.paid`
- `invoice.payment_failed`

## Parcours

```
Stripe → payment-success.html → email clé → formulaire profil → espace client
```
