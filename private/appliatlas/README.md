# USA WAR ATLAS

Application web pédagogique, interactive et sourcée pour comprendre deux siècles de guerres, d'interventions militaires, de conflits indirects, d'opérations clandestines, de pressions économiques et d'acquisitions territoriales des États-Unis.

> **Démarche éditoriale** : l'application n'est ni militante ni propagandiste. Elle distingue systématiquement les faits établis, les justifications officielles, les analyses historiques, les interprétations, les faits débattus et les estimations. Chaque information importante est reliée à une source. Voir `docs/EDITORIAL_RULES.md`.

## Architecture

Monorepo npm workspaces :

```text
usa-war-atlas/
├── apps/
│   ├── web/        # Frontend React + TypeScript + Vite + Tailwind + React Router
│   └── api/        # Backend Node.js + TypeScript + Express + Zod + Prisma
├── packages/
│   ├── shared/     # Types, enums et schémas Zod partagés front/back
│   └── data/       # Données initiales de seed (JSON)
├── prisma/         # schema.prisma, migrations, seed.ts, dev.db (SQLite)
├── docs/           # Méthodologie, règles éditoriales, déploiement, roadmap
├── scripts/        # Config Nginx d'exemple, PM2 (ecosystem.config.cjs)
├── .env.example
└── package.json
```

- **Base de données** : SQLite en développement local. Le schéma Prisma est conçu pour migrer vers PostgreSQL (changer `provider` et `DATABASE_URL`). SQLite ne supportant pas les enums, les champs catégoriels sont des `String` validés par les schémas Zod du package `shared`.
- **API REST** : réponses JSON normalisées `{ success, data, meta }` / `{ success: false, error }`, validation Zod, Helmet, CORS, rate limiting, gestionnaire d'erreurs centralisé.
- **Frontend** : mode sombre par défaut, navigation latérale sur ordinateur, menu mobile, palette « atlas géopolitique » définie dans `apps/web/tailwind.config.js`.

## Prérequis

- Node.js >= 18.17 (LTS recommandée)
- npm >= 9

## Installation

```bash
git clone <votre-depot> usa-war-atlas
cd usa-war-atlas
npm install
cp .env.example .env      # Windows : copy .env.example .env
```

## Base de données (Prisma + SQLite)

```bash
npm run db:generate   # génère le client Prisma
npm run db:migrate    # crée/applique les migrations (dev)
npm run db:seed       # charge les données initiales de démonstration
npm run db:studio     # interface d'exploration Prisma Studio (optionnel)
```

Le fichier SQLite est créé dans `prisma/dev.db` (ignoré par git).

## Lancement local

```bash
npm run dev
```

Lance simultanément :

- l'API sur http://localhost:3001 (santé : `GET /api/health`)
- le frontend sur http://localhost:5173 (proxy `/api` vers l'API)

Lancement séparé : `npm run dev:api` ou `npm run dev:web`.

## Commandes

| Commande | Description |
|---|---|
| `npm run dev` | API + frontend en parallèle |
| `npm run build` | Build shared, API (tsc) et web (vite) |
| `npm run lint` | ESLint sur l'API et le web |
| `npm run test` | Tests Vitest (schémas Zod + intégration API) |
| `npm run db:generate` | Génération du client Prisma |
| `npm run db:migrate` | Migrations de développement |
| `npm run db:deploy` | Migrations en production |
| `npm run db:seed` | Seed des données initiales |

> Les tests d'intégration de l'API nécessitent une base migrée et seedée (`db:migrate` puis `db:seed`).

## Variables d'environnement

Voir `.env.example`. Principales variables :

| Variable | Rôle |
|---|---|
| `DATABASE_URL` | Chaîne de connexion Prisma (SQLite ou PostgreSQL) |
| `API_PORT` | Port de l'API (3001 par défaut) |
| `CORS_ORIGIN` | Origine(s) autorisées, séparées par des virgules |
| `RATE_LIMIT_WINDOW_MS` / `RATE_LIMIT_MAX` | Limitation de débit |
| `ADMIN_TOKEN` | Jeton Bearer protégeant les routes d'écriture (MVP) |
| `VITE_API_URL` | URL de l'API pour le frontend en production |

Ne jamais committer `.env` (déjà dans `.gitignore`).

## API REST

| Endpoint | Description |
|---|---|
| `GET /api/health` | Santé de l'API |
| `GET /api/conflicts` | Liste paginée et filtrable (`category`, `region`, `country`, `startYear`, `endYear`, `isOngoing`, `search`, `page`, `limit`, `sort`) |
| `GET /api/conflicts/:slug` | Fiche détaillée (pays, interventions, pertes, chronologie, sources) |
| `POST /api/conflicts` · `PUT /api/conflicts/:id` · `DELETE /api/conflicts/:id` | Écriture (jeton admin requis) |
| `GET /api/countries` · `GET /api/countries/:iso3` | Pays |
| `GET /api/territories` · `GET /api/territories/:slug` | Acquisitions territoriales |
| `GET /api/sources` · `GET /api/sources/:id` | Sources |
| `GET /api/stats/overview` · `/categories` · `/timeline` · `/economic` | Statistiques |
| `GET /api/compare?conflicts=slug1,slug2` | Comparateur |

## Build

```bash
npm run build
```

- `packages/shared/dist` : types et schémas compilés
- `apps/api/dist` : API Node.js (`node dist/server.js`)
- `apps/web/dist` : frontend statique (Cloudflare Pages / Netlify)

## Déploiement

Voir `docs/DEPLOYMENT.md` : frontend sur Cloudflare Pages ou Netlify, API sur VPS OVH derrière Nginx (`scripts/nginx.conf.example`) avec PM2 (`scripts/ecosystem.config.cjs`), HTTPS, migration vers PostgreSQL.

## Dépannage

- **`@prisma/client` introuvable** : exécuter `npm run db:generate`.
- **Tests API en échec (`no such table`)** : exécuter `npm run db:migrate` puis `npm run db:seed`.
- **Le frontend n'affiche aucune donnée** : vérifier que l'API tourne sur le port 3001 et que le proxy Vite est actif.
- **CORS en production** : renseigner `CORS_ORIGIN` avec l'origine exacte du frontend déployé.
- **Migration PostgreSQL** : changer `provider = "postgresql"` dans `prisma/schema.prisma`, adapter `DATABASE_URL`, recréer les migrations.

## Documentation

- `docs/DATA_METHODOLOGY.md` — méthodologie des données (PIB vs recettes fiscales, coût d'une guerre, inflation…)
- `docs/EDITORIAL_RULES.md` — règles éditoriales et niveaux de certitude
- `docs/DEPLOYMENT.md` — guide de déploiement complet
- `docs/ROADMAP.md` — prochaines étapes

## Prochaines étapes

Voir `docs/ROADMAP.md` : carte MapLibre, chronologie interactive, module pilote guerre américano-mexicaine, comparateur, page sources, espace admin, puis enrichissement à ~20 dossiers.
