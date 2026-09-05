# Règles éditoriales

## 1. Principe fondamental

USA War Atlas est une application pédagogique, ni militante ni propagandiste. Elle documente des faits et donne au lecteur les moyens d'évaluer la fiabilité de chaque information.

## 2. Niveaux de certitude (`certaintyLevel`)

| Valeur | Libellé affiché | Usage |
|---|---|---|
| `ESTABLISHED` | Fait établi | Fait documenté et non contesté par l'historiographie |
| `HIGH_CONFIDENCE` | Confiance élevée | Fortement étayé, avec zones d'ombre mineures |
| `ESTIMATE` | Estimation | Donnée chiffrée issue d'une méthodologie d'estimation |
| `DISPUTED` | Point débattu | Fait ou chiffre contesté entre sources sérieuses |
| `OFFICIAL_CLAIM` | Justification officielle | Position d'un gouvernement, présentée comme telle |
| `INTERPRETATION` | Analyse historique | Interprétation d'historiens ou d'analystes |
| `UNKNOWN` | Donnée à vérifier | Information non encore vérifiée |

Ces niveaux sont affichés visuellement (badges) sur les fiches.

## 3. Justifications officielles

Une justification officielle n'est **jamais** présentée comme une vérité incontestable.

Mauvais :

> Les États-Unis ont envahi l'Irak parce que l'Irak possédait des armes de destruction massive.

Correct :

> L'existence d'armes de destruction massive faisait partie des principales justifications officielles présentées avant l'invasion. Le rapport Duelfer (2004) a conclu à l'absence de stocks au moment de l'invasion.

## 4. Chiffres et estimations

- Aucun chiffre inventé : une donnée non disponible reste `null` / « Donnée à vérifier ».
- Les fourchettes (`minimumValue` / `maximumValue`) sont préférées aux chiffres uniques quand les sources divergent.
- Les estimations issues de méthodologies différentes sont présentées séparément, avec leur méthode.
- Toute statistique doit avoir une source, ou être marquée `needsReview`.

## 5. Sources

- Chaque dossier doit référencer au moins une source (`ConflictSource`).
- Stocker : titre, organisme, lien, date de publication, date de consultation, type, niveau de fiabilité, notes de synthèse rédigées.
- Ne pas copier de contenu protégé : rédiger des synthèses originales.
- Le point de vue institutionnel d'une source (ex. Office of the Historian) est signalé dans les notes.

## 6. Workflow de vérification

Champs de workflow sur les entités éditoriales :

- `verified` : contenu relu et validé ;
- `needsReview` : contenu à relire (par défaut `true` pour tout nouveau contenu) ;
- `lastReviewedAt`, `reviewNotes` : traçabilité de la relecture.

Le contenu de seed est explicitement marqué comme démonstration à enrichir ; l'interface affiche un avertissement sur tout dossier `needsReview`.

## 7. Ton et vocabulaire

- Vocabulaire descriptif et précis ; pas de qualificatifs moralisateurs.
- Les conséquences pour toutes les parties (adversaires, civils, peuples autochtones) sont documentées au même titre que celles pour les États-Unis.
- Les termes chargés (« libération », « pacification », « agression ») ne sont utilisés qu'entre guillemets et attribués à leur émetteur.
