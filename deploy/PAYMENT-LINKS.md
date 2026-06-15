# Payment Links Stripe — URLs de succès TORINVEST

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
