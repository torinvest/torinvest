# Ressources lives / modules — PDF & screens téléchargeables (Premium)

## Objectif

Après chaque **live** (ou module), tu déposes un pack de slides/PDF/screens.
Les élèves Premium les téléchargent depuis :

- `https://app.torinvest-trading.com/resources.html`
- le jour calendrier (`calendar-day.html?date=YYYY-MM-DD`) si le pack a une `liveDate`

Même logique que les livres : **index JSON + fichiers hors Git** sur le VPS.

## Stockage VPS

```bash
sudo mkdir -p /var/lib/torinvest/live-resources
sudo chown ubuntu:ubuntu /var/lib/torinvest/live-resources
```

Env optionnelles :

- `LIVE_RESOURCES_DIR` (défaut `/var/lib/torinvest/live-resources`)
- `LIVE_RESOURCES_INDEX` (défaut `$LIVE_RESOURCES_DIR/index.json`)
- `FORGE_ADMIN_EMAILS` — emails admin qui peuvent publier/retirer des packs

## Seed (slides intégration client 4 pages)

Depuis le repo (ou après `pull-forge-all`) :

```bash
bash /home/ubuntu/torinvest-formation/deploy/vps/seed-live-resources.sh
```

## Après chaque live (workflow coach)

1. Ouvre `resources.html` connecté avec un email de `FORGE_ADMIN_EMAILS`.

2. Remplis le formulaire admin :
   - titre (ex. `Live dimanche — Module 0`)
   - date du live (pour l’affichage calendrier)
   - **Déposer PDF / screens** via le sélecteur de fichiers (envoi direct sur le VPS)
   - optionnel : noms déjà présents sur le disque (fallback scp)

3. Clique **Publier pour les élèves** — upload puis publication.

Types acceptés : PDF, png, jpg, webp, gif — max **10 Mo** par fichier.

## API (aperçu)

| Méthode | Route | Qui |
|--------|--------|-----|
| GET | `/api/live-resources/ping` | public |
| GET | `/api/live-resources` | Premium |
| GET | `/api/live-resources/:id/file/:fileName?download=1` | Premium |
| POST | `/api/live-resources/upload` | Admin (body `dataUrl` base64) |
| POST / PATCH / DELETE | `/api/live-resources...` | Admin |

Filtre date : `GET /api/live-resources?liveDate=2026-09-07`

## Déploiement

```bash
# Hotfix upload navigateur
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/cursor/live-resources-upload-691a/deploy/vps/HOTFIX-LIVE-RESOURCES-UPLOAD.sh" | bash

# Ou pull complet
REF=<commit-ou-branche>
curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-all.sh" | bash
pm2 restart la-forge
```

Vérif :

```bash
curl -s https://app.torinvest-trading.com/api/live-resources/ping
# {"ok":true,"ready":true,"pdfCount":1,"packCount":1}
```
