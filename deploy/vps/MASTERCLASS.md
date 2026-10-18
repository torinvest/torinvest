# Masterclass Macroéconomie & Marchés Financiers

Formation **optionnelle** TORINVEST — La Forge. Indépendante du parcours ÉLITE 37 modules.

## État initial (sécurité)

| Champ | Valeur |
|-------|--------|
| `publication_status` | `draft` |
| `visibility` | `admin_only` |
| `sales_enabled` | `false` |
| Prix / lien paiement | **non renseignés** |

- **Admin** (`FORGE_ADMIN_EMAILS`) : prévisualisation complète
- **Élèves** : refus API + UI (403) tant qu’il n’y a pas de grant ou vente ouverte
- Contenu dans `data/masterclass/chapters/` sur le VPS — **pas** en fichiers statiques publics, **pas** dans le Git public (seed tarball séparé)

## Déploiement

```bash
# 1) Copier le seed (généré hors Git) sur le VPS
scp masterclass-seed.tar.gz ubuntu@VPS:/tmp/

# 2) Deploy code + seed
curl -fsSL \
  "https://raw.githubusercontent.com/torinvest/torinvest/cursor/masterclass-macro-691a/deploy/vps/DEPLOY-MASTERCLASS.sh" \
  -o /tmp/d-mc.sh
MASTERCLASS_SEED_TGZ=/tmp/masterclass-seed.tar.gz bash /tmp/d-mc.sh
```

## Accès

- Hub : `/masterclass.html`
- Chapitre : `/masterclass-chapter.html?n=1`
- Admin grants : panneau sur le hub + `POST /api/masterclass/admin/grants`

## Commercialisation (plus tard)

`PUT /api/masterclass/admin/config` avec `price_amount`, `payment_url`, puis seulement `sales_enabled: true`.  
Publication ≠ ventes. Webhook Stripe → grant (à brancher ultérieurement, hors de ce lot).

## Contenu source

Archive `chapitre1.docx` … `chapitre23.docx` (23 unités pédagogiques).  
Import local : `scripts/import-masterclass-docx.py`
