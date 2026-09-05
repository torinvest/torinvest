# Bibliothèque Livres — La Forge (PDF hors Git)

## Objectif
Page membre `https://app.torinvest-trading.com/books.html` — **tous** les PDF
présents dans `/var/lib/torinvest/books` (typiquement le contenu de
`E:\TORINVEST\livre pdf`, ~108 fichiers), ouverture **Premium only**.

Les PDF **ne sont pas** dans le dépôt Git.

## Stockage VPS

```bash
sudo mkdir -p /var/lib/torinvest/books
sudo chown ubuntu:ubuntu /var/lib/torinvest/books
```

## Upload depuis Windows (`E:\TORINVEST\livre pdf`)

```bash
ssh ubuntu@164.132.46.191 "sudo mkdir -p /var/lib/torinvest/books && sudo chown ubuntu:ubuntu /var/lib/torinvest/books"

scp "E:\TORINVEST\livre pdf\*.pdf" ubuntu@164.132.46.191:/var/lib/torinvest/books/
```

Ou rsync (Git Bash) :

```bash
rsync -avz --include='*.pdf' --exclude='*' \
  "/e/TORINVEST/livre pdf/" \
  ubuntu@164.132.46.191:/var/lib/torinvest/books/
```

Les doublons `(1)` sont masqués dans l’UI s’il existe déjà le fichier sans `(1)`.

## Déploiement code

```bash
APP=/home/ubuntu/torinvest-formation
REF=cursor/formation-livres-all-691a

curl -fsSL "https://raw.githubusercontent.com/torinvest/torinvest/${REF}/deploy/vps/pull-forge-all.sh" \
  | bash -s "$APP"

pm2 restart la-forge --update-env
```

Après merge : `REF=main`.

## Vérif

```bash
curl -s https://app.torinvest-trading.com/api/books/ping
# {"ok":true,"dir":"/var/lib/torinvest/books","pdfCount":108}

# connecté → /books.html doit afficher ~pdfCount ouvrages (pas seulement 12)
```
