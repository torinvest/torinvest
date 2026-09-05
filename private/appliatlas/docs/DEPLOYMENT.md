# Déploiement

Architecture cible : frontend statique sur Cloudflare Pages (ou Netlify), API Node.js sur VPS OVH derrière Nginx avec PM2, base SQLite puis PostgreSQL.

## 1. Frontend — Cloudflare Pages (ou Netlify)

Build :

```bash
npm install
npm run build -w @usa-war-atlas/shared
npm run build -w @usa-war-atlas/web
```

- Répertoire de sortie : `apps/web/dist`
- Variable d'environnement de build : `VITE_API_URL=https://api.votre-domaine.tld`
- SPA : configurer la redirection de toutes les routes vers `index.html`
  - Cloudflare Pages : automatique pour les SPA (ou `_redirects` : `/* /index.html 200`)
  - Netlify : fichier `_redirects` identique

## 2. API — VPS OVH

### Préparation du serveur

```bash
# Node.js LTS via nvm, puis :
npm install -g pm2
```

### Déploiement

```bash
git clone <votre-depot> /var/www/usa-war-atlas
cd /var/www/usa-war-atlas
npm install
cp .env.example .env      # renseigner les valeurs de production
npm run db:generate
npm run db:deploy         # applique les migrations
npm run db:seed           # premier déploiement uniquement
npm run build -w @usa-war-atlas/shared
npm run build -w @usa-war-atlas/api
```

`.env` de production (exemple) :

```env
NODE_ENV=production
API_PORT=3001
DATABASE_URL="file:./dev.db"        # puis PostgreSQL, voir §4
CORS_ORIGIN=https://votre-domaine.tld
ADMIN_TOKEN=<jeton long et aléatoire>
```

### PM2

```bash
pm2 start scripts/ecosystem.config.cjs
pm2 save
pm2 startup    # démarrage automatique au boot
```

## 3. Nginx (reverse proxy + HTTPS)

Copier `scripts/nginx.conf.example` vers `/etc/nginx/sites-available/usa-war-atlas`, adapter le domaine, puis :

```bash
ln -s /etc/nginx/sites-available/usa-war-atlas /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
# HTTPS avec Let's Encrypt :
certbot --nginx -d api.votre-domaine.tld
```

Si le domaine passe par Cloudflare (proxy orange), utiliser le mode SSL « Full (strict) ».

## 4. Migration vers PostgreSQL

1. Provisionner PostgreSQL (VPS ou service managé).
2. Dans `prisma/schema.prisma` : `provider = "postgresql"`.
3. `DATABASE_URL="postgresql://user:password@host:5432/usa_war_atlas"`.
4. Recréer les migrations (`npx prisma migrate dev` sur un environnement de développement pointant vers PostgreSQL, car les migrations SQLite ne sont pas portables), puis `npm run db:deploy` en production.
5. Re-seeder ou migrer les données (export/import JSON prévu dans l'espace admin).

## 5. Docker (alternative)

- `apps/api/Dockerfile` : image de l'API.
- `docker-compose.yml` à la racine : API + volume de données (et PostgreSQL à terme).

```bash
docker compose up -d --build
```

## 6. Checklist sécurité production

- [ ] `.env` jamais commité ; secrets uniquement sur le serveur
- [ ] `ADMIN_TOKEN` long, aléatoire, différent du développement
- [ ] `CORS_ORIGIN` limité à l'origine exacte du frontend
- [ ] HTTPS obligatoire (certbot ou Cloudflare)
- [ ] Pare-feu : seuls 80/443 exposés (l'API n'écoute que sur localhost derrière Nginx)
- [ ] `pm2 logs` + rotation des journaux (`pm2 install pm2-logrotate`)
- [ ] Sauvegardes régulières de la base
