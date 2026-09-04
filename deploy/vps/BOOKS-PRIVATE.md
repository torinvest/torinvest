# Bibliothèque Livres — La Forge (PDF hors Git)

## Objectif
Page membre `https://app.torinvest-trading.com/books.html` — catalogue + ouverture PDF **Premium only**.

Les PDF **ne sont pas** dans le dépôt Git (comme applifonda / modules HTML).

## Stockage VPS

```bash
sudo mkdir -p /var/lib/torinvest/books
sudo chown ubuntu:ubuntu /var/lib/torinvest/books
# optionnel :
# export FORGE_BOOKS_DIR=/var/lib/torinvest/books
```

## Upload depuis Windows (dossier `E:\TORINVEST\livre pdf`)

Sur le PC (PowerShell / Git Bash), depuis le dossier des PDF :

```bash
# adapter user@host
scp -r *.pdf ubuntu@VPS_IP:/var/lib/torinvest/books/
```

Ou rsync :

```bash
rsync -avz --include='*.pdf' --exclude='*' \
  "/e/TORINVEST/livre pdf/" \
  ubuntu@VPS_IP:/var/lib/torinvest/books/
```

**Noms de fichiers** : garder les noms exacts (ex. `386961563-Alexandre-Elder-Vivre-Du-Trading.pdf`).
Le catalogue `books-data.js` pointe vers ces noms.

Doublons locaux à ignorer côté upload (une seule copie suffit) :
- `111311835-La-monnaie-et-ses-mecanismes (1).pdf` → garder sans `(1)`
- `260896588-La-Liquidite-Incontrolable (1).pdf` → idem

## Déploiement code formation

```bash
APP=/home/ubuntu/torinvest-formation
REF=main   # ou SHA / branche cursor/formation-livres-691a

curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-all.sh" \
  | bash -s "$APP"

pm2 restart la-forge --update-env
```

## Vérif

```bash
curl -s https://app.torinvest-trading.com/api/books/ping
# {"ok":true,"dir":"/var/lib/torinvest/books","pdfCount":18}

# connecté Premium → ouvrir /books.html puis « Ouvrir le PDF »
```
