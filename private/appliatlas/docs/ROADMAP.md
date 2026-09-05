# Roadmap

## Étape actuelle — Socle (fait)

- [x] Monorepo npm workspaces (apps/web, apps/api, packages/shared, packages/data)
- [x] Prisma + SQLite : schéma complet (12 modèles), migrations, seed
- [x] Seed initial : guerre américano-mexicaine, guerre du Vietnam, guerre d'Irak 2003 (+ cession mexicaine de 1848)
- [x] API REST : conflits (CRUD + filtres + pagination), pays, territoires, sources, stats, comparateur
- [x] Sécurité : Helmet, CORS, rate limiting, validation Zod, gestion d'erreurs centralisée, routes d'écriture protégées
- [x] Frontend : accueil, /conflits (filtres, tri, pagination), /conflits/:slug (fiche complète)
- [x] Tests : schémas Zod + intégration API
- [x] Documentation : README, méthodologie, règles éditoriales, déploiement

## Étape — Cartographie et chronologie (fait)

- [x] Page carte MapLibre : marqueurs par pays, couleurs par catégorie, popups, légende, filtres (catégorie, période, région, statut, clandestin), recherche de pays, compteur
- [x] Page chronologie : frise interactive par périodes (expansion territoriale, impérialisme, guerres mondiales, guerre froide, post-soviétique, guerre contre le terrorisme, rivalités contemporaines) + graphique par décennie
- [x] Endpoint `GET /api/conflicts/geo` (conflits + coordonnées + indicateur clandestin)
- [ ] Filtre par président (nécessite l'ajout du modèle de données correspondant)

## Étape — Module pilote guerre américano-mexicaine (fait)

- [x] Dossier pilote enrichi (annexion du Texas, différend frontalier, batailles, Spot Resolutions, traité, Gadsden)
- [x] Blocs statistiques : prix historique, valeur corrigée de l'inflation, superficie, PIB, recettes fiscales, dépenses fédérales, population — chacun avec année, source, périmètre, méthode et statut (officielle / estimation / à vérifier)
- [x] Population 2020 des 7 États intégrée (Census Bureau, donnée officielle sourcée)
- [x] Avertissements méthodologiques affichés (frontières actuelles ≠ 1848, achat Gadsden, Colorado/Wyoming partiels, non-attribution du PIB moderne)
- [x] Pages /territoires et /territoires/:slug + relation territoire ↔ conflit + achat Gadsden en dossier distinct
- [ ] Intégration des données BEA (PIB) et IRS (recettes/dépenses fédérales) — actuellement affichées « Donnée à vérifier »

## Étape — Comparateur, sources, admin (fait)

- [x] Page comparateur : 2 conflits côte à côte (période, durée, catégorie, adversaires, pertes, justification officielle signalée comme telle, base juridique, résultats, conséquences territoriales, sources)
- [x] Page sources avec filtres (recherche organisme/titre, type, fiabilité, conflit associé)
- [x] Espace /admin protégé par jeton : marquage vérifié (avec lastReviewedAt) / à revoir / débattu, création de conflit et de source, suppression, ajout d'intervention (API), import JSON (upsert par slug, needsReview forcé), export JSON complet
- [x] API : POST/DELETE /api/sources, POST /api/conflicts/:id/interventions, GET /api/admin/export, POST /api/admin/import
- [ ] Édition complète des champs longs d'un conflit dans l'admin (actuellement via API/import)
- [ ] Modification des statistiques (CasualtyEstimate, EconomicMetric) dans l'admin
- [ ] Moteur de recherche global (la recherche par liste existe)

## Étape — Enrichissement éditorial MVP (~20 dossiers) (fait)

- [x] 20 dossiers de conflits dans le seed (1812 → Syrie/EI), tous marqués `needsReview`
- [x] Pays et sources étendus (Office of the Historian, ONU, OTAN, CIJ, AUMF, CRS…)
- [x] Pertes militaires US sourcées (CRS) quand disponibles ; civils/adverses laissés à « Donnée à vérifier »
- [x] Tests de couverture MVP (20 slugs, périodes chronologiques)
- [ ] Relecture éditoriale dossier par dossier (`verified: true`)
- [ ] Intégration BEA/IRS pour le module territorial mexicain
- [ ] Moteur de recherche global frontend

## Plus tard (architecture prévue, non implémentée)

- Authentification complète (sessions/JWT, rôles) en remplacement du jeton admin
- PostgreSQL en production
- Authentification sociale, paiements, application mobile, chatbot IA
